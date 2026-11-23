"""Only installation downloads weights; inference uses these pinned local files."""
import json
from huggingface_hub import snapshot_download
from chatterbox_worker import MODEL_ID, MODEL_REVISION, MODEL_FILES, RUNTIME

if __name__ == '__main__':
    snapshot_download(MODEL_ID, revision=MODEL_REVISION, local_dir=str(RUNTIME / 'model'),
                      allow_patterns=list(MODEL_FILES))
    print(json.dumps({'model': MODEL_ID, 'revision': MODEL_REVISION}))
