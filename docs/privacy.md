# Privacy and local data

[Back to README](../README.md)

## Public repository

Only source code, tests, documentation and app icons are published. No personal voice recordings, generated speech, speaker embeddings, AI weights, credentials or user profiles are included.

`.gitignore` excludes common audio/video/model formats, local settings, signing keys, `.env` files, release binaries and `test-results/`. Ignore rules are not encryption: review staged files before pushing and do not force-add private files.

## Local storage

| Location | Contents |
| --- | --- |
| `%APPDATA%/Sidecast/settings.json` | Profiles, source token, connection settings and encrypted saved password |
| `%APPDATA%/Sidecast/audio/voice/` | Selected reference recording and its name |
| `%APPDATA%/Sidecast/audio/media/` | Imported/built-in sounds and generated alert speech cache |
| `%LOCALAPPDATA%/Sidecast/tts/` | Qwen runtime, model and local logs |
| `%LOCALAPPDATA%/Sidecast/chatterbox/` | Separate Chatterbox runtime, model and logs |
| Checkout `test-results/` and temporary test profiles | Test artifacts, potentially including locally generated voice test audio |

Chat history stays in memory and is discarded on exit. Alert TTS can create cached audio containing viewer text on disk; the cache is pruned to approximately 100 generated files. Imported sounds and the reference remain until removed/replaced.

Voice-preview temporary files are removed after being read for local playback. The preview remains in the control window until stopped/replaced or the window closes. Explicit developer voice tests can leave results in ignored local folders.

## Connections and access

- Sidecast connects to your configured Streamer.bot server.
- Browser sources bind only to `127.0.0.1` and require the URL token. Keep that token private.
- Source routes do not expose the private reference recording. Generated alert audio is available to the authenticated local audio source.
- AI setup downloads packages/models. Supported inference runs locally afterward; there is no cloud voice-upload step.
- Emote catalog/image requests contact public providers/CDNs. Channel catalog requests use channel identifiers; event-provided HTTPS images may use other hosts.

Saved passwords use Electron's Windows-backed encryption. If it is unavailable, passwords stay in memory instead of being stored as plaintext. Use **Remove saved password** to clear the saved password.

## Reports and cleanup

Do not upload `settings.json`, the audio directory, your reference, generated voice clips or complete runtime/user-data folders. Redact tokens, passwords, private paths and unwanted chat identities from screenshots and logs.

To remove voice data, quit Sidecast and remove the specific recording/cache files at the locations above. Back up settings/sounds you want to keep. Removing an AI runtime/model folder requires reinstalling that engine.
