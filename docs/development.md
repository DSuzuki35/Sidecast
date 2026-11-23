# Development and packaging

[Back to README](../README.md)

## Environment

Use Windows x64, Node.js 24 LTS, npm and PowerShell. Run `npm ci`, then `npm start`. Optional AI engines install their own isolated Python environments.

The `private: true` flag in package.json prevents accidental npm publication; it does not make the GitHub repository private.

## Architecture

| Path | Responsibility |
| --- | --- |
| `src/core/` | Normalized events, shared Hub/queue/history, settings and templates |
| `src/connection.js` | Streamer.bot WebSocket connection |
| `src/server.js` | Authenticated loopback browser/audio source server |
| `src/main.js` | Electron windows, IPC and lifecycle |
| `src/audio-service.js` | Serial speech jobs, workers, cache and private previews |
| `public/` | Control UI and shared overlay/audio renderers |
| `tts/` | Python workers, model downloads and dependencies |
| `scripts/`, `test/` | Setup, packaging and tests |

One Hub distributes state to desktop, preview and OBS. Appearance resolves by output; contents and audio remain shared. Browser endpoints are read-only. More details: [TTS](tts-engine.md), [emotes](emotes.md), [performance](performance-review.md).

## Verification

```powershell
npm test
npm run test:ui
node scripts/alert-message-smoke.mjs
node scripts/both-alerts-smoke.mjs
node scripts/speech-preview-smoke.mjs
npm run test:performance -- local
```

Some tests require installed Windows speech voices. Electron checks use temporary profiles and free source ports and may briefly show test windows. They do not send messages to real streaming platforms. With TTS dependencies installed, Python checks run with `python -m unittest discover -s tts`.

The separate `qwen-smoke.mjs`, `chatterbox-smoke.mjs` and `chatterbox-preview-smoke.mjs` checks use a reference already selected locally in Sidecast. Run them only when you intend to use that recording. Never commit their output.

To check a folder build:

```powershell
$env:SIDECAST_EXECUTABLE = (Resolve-Path release/win-unpacked/Sidecast.exe).Path
node scripts/alert-message-smoke.mjs
Remove-Item Env:SIDECAST_EXECUTABLE
```

## Packaging and signing

```powershell
npm run pack         # Folder build
npm run dist         # Unsigned portable EXE
npm run dist:signed  # Requires your own available signing certificate
```

SimplySign Desktop can expose a certificate through the Windows personal store. The script selects a single valid code-signing certificate with a private key. If several exist, set `SIDECAST_SIGNING_THUMBPRINT` to your intended certificate. It verifies signatures and timestamps and fails on invalid signing. No certificate/private key/password is distributed here.

## Publishing changes

Review `git diff --cached` and `git status`. Never stage test outputs, recordings, generated speech, embeddings/models, settings or signing material. Force-adding files bypasses `.gitignore`. Use synthetic event fixtures and redact private data in reports. See [Privacy](privacy.md).

Source uses the MIT license; dependencies and downloaded models retain their own licenses.
