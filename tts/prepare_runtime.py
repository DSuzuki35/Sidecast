"""Verify native dependencies and expose the bundled FFmpeg at a stable path."""
import json
import shutil
import imageio_ffmpeg
import qwen_tts
import soundfile
import torch
from worker import RUNTIME

if __name__ == "__main__":
    destination = RUNTIME / "tools" / "ffmpeg.exe"
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(imageio_ffmpeg.get_ffmpeg_exe(), destination)
    print(json.dumps({"torch": torch.__version__, "cuda": torch.cuda.is_available(),
                      "ffmpeg": str(destination)}))
