# Local voice-cloning engine

Sidecast uses **Qwen/Qwen3-TTS-12Hz-0.6B-Base**, an Apache-2.0 model supporting English and German voice cloning. It runs locally after a one-time dependency/model download. This does not call a paid speech API or upload recordings. Use your own voice or a voice you have permission to use.

## Setup on Windows

From the repository (or the unpacked application resources directory):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-tts.ps1
```

Setup installs everything under `%LOCALAPPDATA%\Sidecast\tts`. It does not edit PATH, register a global Python interpreter, or require administrator access. Allow several GB of downloads and disk space. The pinned PyTorch CUDA 12.8 build supports NVIDIA GPUs including the RTX 5090; a compatible NVIDIA driver is required. `-CpuOnly` installs the CPU build instead. CPU generation is much slower. `-SkipModelDownload` installs dependencies only and does not mark an incomplete setup ready.

The interpreter is `%LOCALAPPDATA%\Sidecast\tts\venv\Scripts\python.exe`; FFmpeg is `%LOCALAPPDATA%\Sidecast\tts\tools\ffmpeg.exe`. `setup.json` is written after a complete setup. For a live file/dependency readiness check:

```powershell
& "$env:LOCALAPPDATA\Sidecast\tts\venv\Scripts\python.exe" .\tts\worker.py --status
```

This checks installed package metadata and model files, without allocating GPU memory. Setup separately verifies that the native dependencies import. A generation test is the strongest readiness check.

## Reference recording

Use 3–30 seconds of clear speech, preferably 10–20 seconds with no music, other speakers, strong reverb, or clipping. A WAV file is required by the worker; FFmpeg can extract a mono WAV segment from an owned MP3. A matching transcript improves conditioning. When the transcript is empty, the model uses speaker-embedding-only cloning (`x_vector_only_mode=True`). This can sound less similar than a clean reference plus accurate transcript. Language/accent and recording quality affect the result; the reference is not model training.

## Worker contract

Launch the isolated Python interpreter with `-u tts/worker.py --root <absolute-audio-directory>`. Start the process hidden, pipe stdin/stdout/stderr, and retain it only while needed. Loading is lazy; the model and one reference prompt stay resident between requests. Stopping the worker releases GPU memory.

Send one UTF-8 JSON object per line:

```json
{"id":"alert-1","text":"Danke fuer deinen Follow!","language":"German","reference":"C:\\audio\\voice\\reference.wav","referenceText":"","output":"C:\\audio\\cache\\alert-1.wav","device":"cuda"}
```

The example requires `--root C:\audio`. Supported languages are `English` and `German`, devices are `cuda` and `cpu`. Text is limited to 400 characters. Reference and output must be absolute WAV paths inside the supplied root; resolved links and `..` escapes are rejected. Output must differ from the reference. The worker writes PCM16 WAV atomically. It returns one matching response per request:

```json
{"id":"alert-1","ok":true,"path":"C:\\audio\\cache\\alert-1.wav","duration":2.32}
```

Failures return `{"id":"alert-1","ok":false,"error":"User-readable message"}`. Native-library output and tracebacks go to stderr; stdout is only protocol JSON. Never expose raw stderr in an overlay. The worker does not open a network listener. Model loading sets Hugging Face offline mode, and the pinned model is loaded from the local directory. Setup is the only download phase.

GPU uses bfloat16 with PyTorch SDPA, so no FlashAttention build is needed on Windows. CPU uses float32 and at most four PyTorch threads. Long text is split into sentence/word chunks up to 240 characters, generated with a 960-codec-step budget per chunk, then concatenated. Segments reaching the budget and output over six minutes are rejected rather than cached as complete. Expanded text is limited to 6,000 characters; text is never silently shortened at the speech layer. Callers should additionally enforce a process timeout and queue limits. This implementation renders the complete WAV before playback; the upstream streaming latency claim is not the latency of this integration. Cold start includes Python imports and model loading, and generation competes with games/OBS for GPU resources.

Upstream imports may print optional FlashAttention and SoX warnings. This worker uses SDPA and passes decoded waveform arrays directly, so neither optional command is used for the supported path.

## Verification

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-tts.ps1
# Optional real inference, using a synthetic Windows SAPI reference:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-tts.ps1 -Generate
```

The first command tests protocol recovery, length/language/device/transcript validation, traversal rejection, relative-path rejection, and reference-overwrite protection without importing the model. `-Generate` exercises English, German, cached-reference reuse, and transcript-free cloning. It leaves WAVs under the isolated runtime's `smoke-audio` folder and exits the worker after completion.

On the development RTX 5090, an authorized 15-second own-voice reference produced a 4.40-second German alert in 32.53 seconds including cold startup, followed by a 2.64-second English alert in 5.41 seconds with the loaded model/reference cache. Those are observed end-to-end timings, not guaranteed latency. The recordings are valid 24 kHz mono PCM16 WAV. Voice resemblance still needs listening evaluation; a matching transcript and a clean reference may improve it.

Pinned components: Python 3.12.16 via Astral uv 0.13.9 (download SHA256 verified), PyTorch/torchaudio 2.9.1 CUDA 12.8, qwen-tts 0.1.1, soundfile 0.13.1, imageio-ffmpeg 0.6.0. Qwen model revision: `5d83992436eae1d760afd27aff78a71d676296fc`. Transitive Python dependencies are resolved by uv; rerunning setup may update unpinned transitive packages.

## Primary sources

- [Qwen3-TTS repository and voice-clone API](https://github.com/QwenLM/Qwen3-TTS)
- [0.6B Base model card and license](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base)
- [Qwen Python implementation: cached voice prompts and transcript-free mode](https://github.com/QwenLM/Qwen3-TTS/blob/main/qwen_tts/inference/qwen3_tts_model.py)
- [Official PyTorch previous-version installation commands](https://pytorch.org/get-started/previous-versions/)
- [Astral uv managed Python](https://docs.astral.sh/uv/concepts/python-versions/)
- [imageio-ffmpeg project and bundled FFmpeg binaries](https://github.com/imageio/imageio-ffmpeg)

## Chatterbox expression (0.2.8)

Optional isolated engine in `%LOCALAPPDATA%/Sidecast/chatterbox`. `scripts/setup-chatterbox.ps1` installs Python 3.11.15, Torch/torchaudio 2.9.1 CUDA 12.8 (or CPU), PyPI chatterbox-tts 0.1.6 and the listed dependencies. The upstream Torch 2.6 requirement is deliberately overridden for RTX 50-series support. No global Python changes. Downloads use the pinned official ResembleAI/chatterbox revision `5bb1f6ee58e50c3b8d408bc82a6d3740c2db6e18`; the loader uses safetensors on CPU before moving to the selected device. The multilingual V2 model supports the existing English/German selector. The newer V3 model has not been validated in this integration.

Expressiveness 0–100 maps directly to Chatterbox `exaggeration` 0–1. At 65 or higher, `cfg_weight` is reduced from 0.5 to 0.3, following upstream pacing advice. Default 50, suggested starting point 75. This is stronger expression, not a guaranteed happiness/excitement emotion. The same private WAV reference is reused and never uploaded. Model/reference conditioning and finished speech are cached; expression is part of the cache key. Only one AI worker remains loaded at a time and it unloads after 60 seconds idle. Preview audio remains private. Inference runs offline with a 180-second job timeout. The queue pauses its stale-event expiry during synthesis and playback, including for alerts waiting behind a long spoken message.

Primary source: [Chatterbox usage and expressive speech guidance](https://github.com/resemble-ai/chatterbox). License: MIT. Local audio includes the model's built-in Perth watermark.

### Verified on 2026-11-23

Actual user-authorized local voice reference: Chatterbox cold 50% generation took 25.86s (2.60s speech), warm 75% took 3.08s (2.44s speech). A 468-character attached English message produced 25.08s including queue padding in 17.85s; German synthesis also passed. First-ever run included dependency/JIT initialization and took 42.73s. Qwen's >400-character regression produced 28.56s speech in 62.78s. These are this machine's measurements, not perceived voice-quality claims or gaming FPS guarantees.

Windows integration fixes: official safetensors omit the deterministic tokenizer.window buffer, which is reconstructed by the model constructor; all other missing/unexpected model weights remain errors. Setuptools 80.9.0 is required by Perth's pkg_resources import. The genuine watermark remains enabled. The English/German tokenizer adapter avoids upstream's automatic download of an unrelated Chinese segmenter at inference time.
