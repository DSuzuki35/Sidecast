"""Local multilingual voice cloning with genuine model-side expression control."""
import gc
import math
import os
from pathlib import Path
import tempfile
import worker

MODEL_ID = 'ResembleAI/chatterbox'
MODEL_REVISION = '5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18'
MODEL_FILES = ('ve.safetensors', 's3gen.safetensors', 't3_mtl23ls_v2.safetensors',
               'grapheme_mtl_merged_expanded_v1.json')
RUNTIME = Path(os.environ.get('LOCALAPPDATA', str(Path.home()))) / 'Sidecast' / 'chatterbox'


def expression_settings(value):
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or not 0 <= value <= 100:
        raise worker.RequestError('Expressiveness must be between 0 and 100.')
    # The actual Chatterbox exaggeration parameter; lower CFG compensates for faster expressive delivery.
    return value / 100, 0.3 if value >= 65 else 0.5


class Engine:
    def __init__(self, root):
        self.root = root.resolve()
        self.model = self.device = self.prompt_key = None

    def load(self, device):
        if self.model is not None and self.device == device:
            return
        import torch
        if device == 'cuda' and not torch.cuda.is_available():
            raise worker.RequestError('CUDA is unavailable. Select CPU or install a compatible NVIDIA driver.')
        directory = RUNTIME / 'model'
        if not all((directory / name).is_file() for name in MODEL_FILES):
            raise worker.RequestError('Install the Chatterbox voice engine first.')
        self.model = self.prompt_key = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        torch.set_num_threads(min(4, os.cpu_count() or 1))
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS, T3, T3Config, S3Gen, VoiceEncoder, MTLTokenizer
        from safetensors.torch import load_file
        # Load safe tensor files on CPU first, also supporting CPU-only machines.
        ve = VoiceEncoder()
        ve.load_state_dict(load_file(str(directory / 've.safetensors')))
        t3 = T3(T3Config.multilingual())
        t3.load_state_dict(load_file(str(directory / 't3_mtl23ls_v2.safetensors')))
        s3gen = S3Gen()
        loaded = s3gen.load_state_dict(load_file(str(directory / 's3gen.safetensors')), strict=False)
        # Official safetensors omit deterministic tokenizer buffers built by the constructor.
        if set(loaded.missing_keys) - {'tokenizer.window', 'tokenizer._mel_filters'} or loaded.unexpected_keys:
            raise worker.RequestError('Chatterbox model files do not match this engine. Rerun setup.')
        from tokenizers import Tokenizer

        class LocalTokenizer(MTLTokenizer):
            def __init__(self, path):
                # Upstream eagerly downloads an unrelated Chinese segmenter. Sidecast only exposes en/de.
                self.tokenizer = Tokenizer.from_file(path)
                self.cangjie_converter = None
                self.check_vocabset_sot_eot()

        tokenizer = LocalTokenizer(str(directory / 'grapheme_mtl_merged_expanded_v1.json'))
        self.model = ChatterboxMultilingualTTS(t3.to(device).eval(), s3gen.to(device).eval(),
                                              ve.to(device).eval(), tokenizer, device)
        self.device = device

    def generate(self, request):
        text, _, reference, output = worker.validate(request, self.root)
        exaggeration, cfg = expression_settings(request.get('expressiveness', 50))
        import numpy as np
        import soundfile as sf
        info = sf.info(str(reference))
        if info.format not in ('WAV', 'WAVEX') or not 3 <= info.duration <= 30:
            raise worker.RequestError('Use a WAV voice reference between 3 and 30 seconds.')
        audio, _ = sf.read(str(reference), dtype='float32')
        if not np.isfinite(audio).all() or np.max(np.abs(audio)) < 0.001:
            raise worker.RequestError('The voice reference is silent or invalid. Record it again.')
        self.load(request['device'])
        import torch
        key = (str(reference), reference.stat().st_mtime_ns, reference.stat().st_size, exaggeration)
        with torch.inference_mode():
            if key != self.prompt_key:
                self.model.prepare_conditionals(str(reference), exaggeration=exaggeration)
                self.prompt_key = key
            segments = []
            for chunk in worker.split_text(text, limit=200):
                if not chunk.strip():
                    continue
                wav = self.model.generate(chunk.strip(), language_id='de' if request['language'] == 'German' else 'en',
                                          exaggeration=exaggeration, cfg_weight=cfg).detach().cpu().numpy().reshape(-1)
                if not wav.size or not np.isfinite(wav).all():
                    raise worker.RequestError('Chatterbox produced invalid audio. Try again.')
                if len(wav) / self.model.sr >= 39:
                    raise worker.RequestError('Chatterbox did not finish a sentence. Please try again.')
                segments.append(wav)
                if sum(len(part) for part in segments) / self.model.sr > 360:
                    raise worker.RequestError('Generated speech exceeded six minutes.')
        wav = np.concatenate(segments)
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=output.parent, suffix='.wav', delete=False) as handle:
            temporary = Path(handle.name)
        try:
            sf.write(str(temporary), wav, self.model.sr, subtype='PCM_16')
            temporary.replace(output)
        finally:
            temporary.unlink(missing_ok=True)
        return {'ok': True, 'duration': len(wav) / self.model.sr, 'segments': len(segments)}


def status():
    import torch
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    import perth
    if perth.PerthImplicitWatermarker is None:
        raise worker.RequestError('Chatterbox watermark dependencies are missing. Rerun setup.')
    ready = all((RUNTIME / 'model' / name).is_file() for name in MODEL_FILES)
    return {'ok': ready, 'model': MODEL_ID, 'revision': MODEL_REVISION, 'cuda': torch.cuda.is_available()}


if __name__ == '__main__':
    worker.Engine = Engine
    worker.status = status
    worker.main()
