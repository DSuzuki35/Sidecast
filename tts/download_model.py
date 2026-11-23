"""Setup-only model download. Normal synthesis is offline."""
import json
from pathlib import Path
from huggingface_hub import snapshot_download
from worker import MODEL_ID, MODEL_REVISION, RUNTIME

if __name__ == "__main__":
    snapshot_download(MODEL_ID, revision=MODEL_REVISION, local_dir=str(RUNTIME / "model"))
    print(json.dumps({"model": MODEL_ID, "revision": MODEL_REVISION, "path": str(RUNTIME / "model")}))
