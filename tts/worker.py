"""Local Qwen voice cloning worker. Stdout is exclusively newline-delimited JSON."""
import argparse
import gc
import json
import os
import re
from pathlib import Path
import sys
import tempfile
import traceback

MODEL_ID = "Qwen/Qwen3-TTS-12Hz-0.6B-Base"
MODEL_REVISION = "5d83992436eae1d760afd27aff78a71d676296fc"
RUNTIME = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "Sidecast" / "tts"


class RequestError(Exception):
    pass


def split_text(text, limit=240):
    """Keep every character, preferring sentence/word boundaries over hard cuts."""
    chunks = []
    while len(text) > limit:
        window = text[:limit]
        sentences = list(re.finditer(r'[.!?。！？][\s]+', window))
        words = list(re.finditer(r'\s+', window))
        boundary = sentences[-1].end() if sentences else words[-1].end() if words else limit
        if boundary < limit // 3:
            boundary = words[-1].end() if words and words[-1].end() >= limit // 3 else limit
        chunks.append(text[:boundary])
        text = text[boundary:]
    if text:
        chunks.append(text)
    return chunks


def confined_path(value, root, label):
    if not isinstance(value, str) or not value or not Path(value).is_absolute():
        raise RequestError(f"{label} must be an absolute local path.")
    candidate = Path(value).resolve()
    if not candidate.is_relative_to(root) or candidate == root:
        raise RequestError(f"{label} must be inside the audio directory.")
    if candidate.suffix.lower() != ".wav":
        raise RequestError(f"{label} must be a WAV file.")
    return candidate


def validate(request, root):
    if not isinstance(request, dict):
        raise RequestError("Request must be a JSON object.")
    text = request.get("text")
    if not isinstance(text, str) or not text.strip() or len(text) > 6000:
        raise RequestError("Enter between 1 and 6000 characters.")
    if request.get("language") not in ("English", "German"):
        raise RequestError("Choose English or German.")
    if request.get("device") not in ("cpu", "cuda"):
        raise RequestError("Choose CPU or CUDA.")
    transcript = request.get("referenceText", "")
    if not isinstance(transcript, str) or len(transcript) > 4000:
        raise RequestError("Reference transcript must be text up to 4000 characters.")
    reference = confined_path(request.get("reference"), root, "Reference")
    output = confined_path(request.get("output"), root, "Output")
    if reference == output:
        raise RequestError("Output must not overwrite the voice reference.")
    if not reference.is_file():
        raise RequestError("Record or select your voice reference first.")
    if reference.stat().st_size > 30 * 1024 * 1024:
        raise RequestError("Reference WAV must be smaller than 30 MB.")
    return text.strip(), transcript.strip(), reference, output


class Engine:
    def __init__(self, root):
        self.root = root.resolve()
        self.model = None
        self.device = None
        self.prompt = None
        self.prompt_key = None

    def load(self, device):
        if self.model is not None and self.device == device:
            return
        import torch
        if device == "cuda" and not torch.cuda.is_available():
            raise RequestError("CUDA is unavailable. Select CPU or install a compatible NVIDIA driver.")
        if not (RUNTIME / "model" / "model.safetensors").is_file():
            raise RequestError("Local speech model is missing. Run the TTS setup first.")
        self.model = self.prompt = self.prompt_key = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        torch.set_num_threads(min(4, os.cpu_count() or 1))
        from qwen_tts import Qwen3TTSModel
        self.model = Qwen3TTSModel.from_pretrained(
            str(RUNTIME / "model"), device_map="cuda:0" if device == "cuda" else "cpu",
            dtype=torch.bfloat16 if device == "cuda" else torch.float32,
            attn_implementation="sdpa", local_files_only=True,
        )
        self.device = device

    def generate(self, request):
        text, transcript, reference, output = validate(request, self.root)
        import numpy as np
        import soundfile as sf
        info = sf.info(str(reference))
        if info.format not in ("WAV", "WAVEX") or not 3 <= info.duration <= 30:
            raise RequestError("Use a WAV voice reference between 3 and 30 seconds.")
        audio, sr = sf.read(str(reference), dtype="float32", always_2d=True)
        audio = audio.mean(axis=1)
        if not np.isfinite(audio).all() or np.max(np.abs(audio)) < 0.001:
            raise RequestError("The voice reference is silent or invalid. Record it again.")
        self.load(request["device"])
        import torch
        key = (str(reference), reference.stat().st_mtime_ns, reference.stat().st_size, transcript)
        with torch.inference_mode():
            if self.prompt_key != key:
                self.prompt = self.model.create_voice_clone_prompt(
                    ref_audio=(audio, sr), ref_text=transcript or None,
                    x_vector_only_mode=not bool(transcript),
                )
                self.prompt_key = key
            segments = []
            for chunk in split_text(text):
                if not chunk.strip():
                    continue
                wavs, sample_rate = self.model.generate_voice_clone(
                    text=chunk.strip(), language=request["language"], voice_clone_prompt=self.prompt,
                    non_streaming_mode=True, max_new_tokens=960,
                )
                segment = np.asarray(wavs[0])
                if not segment.size or not np.isfinite(segment).all():
                    raise RequestError("The speech model produced invalid audio. Try again.")
                # A segment hitting the generation budget is likely unfinished; never cache it as complete.
                if len(segment) / sample_rate >= 79:
                    raise RequestError("The speech model did not finish a sentence. Please try again.")
                segments.append(segment)
                if sum(len(part) for part in segments) / sample_rate > 360:
                    raise RequestError("Generated speech exceeded six minutes.")
        wav = np.concatenate(segments)
        if not wav.size or not np.isfinite(wav).all():
            raise RequestError("The speech model produced invalid audio. Try a shorter message.")
        duration = len(wav) / sample_rate
        if duration > 360:
            raise RequestError("Generated audio exceeded six minutes.")
        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=output.parent, suffix=".wav", delete=False) as handle:
            temporary = Path(handle.name)
        try:
            sf.write(str(temporary), wav, sample_rate, subtype="PCM_16")
            temporary.replace(output)
        finally:
            temporary.unlink(missing_ok=True)
        return {"ok": True, "path": str(output), "duration": round(duration, 3)}


def status():
    import importlib.metadata
    packages = {}
    for name in ("torch", "torchaudio", "qwen-tts", "soundfile"):
        try:
            packages[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            packages[name] = None
    files = ("config.json", "model.safetensors", "speech_tokenizer/model.safetensors")
    model_ready = all((RUNTIME / "model" / name).is_file() for name in files)
    return {"ok": all(packages.values()) and model_ready, "python": sys.executable,
            "model": MODEL_ID, "modelReady": model_ready, "packages": packages}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path)
    parser.add_argument("--status", action="store_true")
    args = parser.parse_args()
    # Redirect OS-level stdout too: native dependencies may bypass Python's streams.
    protocol = os.fdopen(os.dup(sys.stdout.fileno()), "w", encoding="utf-8", buffering=1)
    os.dup2(sys.stderr.fileno(), sys.stdout.fileno())
    sys.stdout = sys.stderr
    sys.stdin.reconfigure(encoding="utf-8")
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
    os.environ["DO_NOT_TRACK"] = "1"
    if args.status:
        protocol.write(json.dumps(status()) + "\n")
        return
    if args.root is None or not args.root.is_absolute():
        parser.error("--root must be an absolute audio directory")
    engine = Engine(args.root)
    for line in sys.stdin:
        request = None
        try:
            if len(line) > 65536:
                raise RequestError("Request is too large.")
            request = json.loads(line)
            result = engine.generate(request)
        except (json.JSONDecodeError, UnicodeError):
            result = {"ok": False, "error": "Request must be valid UTF-8 JSON."}
        except RequestError as error:
            result = {"ok": False, "error": str(error)}
        except Exception as error:
            traceback.print_exc(file=sys.stderr)
            if "out of memory" in str(error).lower():
                message = "Not enough GPU memory. Close GPU-heavy apps or select CPU."
            else:
                message = "Local speech generation failed. Check the TTS log and rerun setup if needed."
            result = {"ok": False, "error": message}
        result["id"] = request.get("id") if isinstance(request, dict) else None
        protocol.write(json.dumps(result, ensure_ascii=False) + "\n")
        protocol.flush()


if __name__ == "__main__":
    main()
