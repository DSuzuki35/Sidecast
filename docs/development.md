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
npm run dist         # Windows x64 NSIS installer; no automatic publishing
npm run dist:portable # Portable EXE; no automatic updates
npm run dist:signed  # Requires your own available signing certificate
```

SimplySign Desktop can expose a certificate through the Windows personal store. The script selects a single valid code-signing certificate with a private key. If several exist, set `SIDECAST_SIGNING_THUMBPRINT` to your intended certificate. It verifies signatures and timestamps and fails on invalid signing. No certificate/private key/password is distributed here.

## Installer and updates

The NSIS wizard installs Sidecast with Start menu and desktop shortcuts. `npm run dist:signed` writes to `release/<version>/` so a running older folder build is left alone. It signs and timestamps both the application and setup, and generates `latest.yml` and the installer `.blockmap`. Never modify or re-sign the setup after generating metadata: its SHA-512 must match `latest.yml`.

The pinned electron-updater 6 API checks the public `DSuzuki35/Sidecast` GitHub release feed without credentials. The installed app checks after 15 seconds and every six hours. Downloads are serialized; code signatures are checked against `Open Source Developer Daniel Sosulski`. Stable updates only; no downgrades. Installation happens on normal quit after application cleanup, with no forced relaunch. Development, portable, unpacked and `SIDECAST_DATA_DIR` test profiles never check automatically. The control window is the only IPC client allowed to request an update check.

For a release, increment package/package-lock and the visible version, update download links, run tests and Claude review, build/sign, inspect the archive for private files, and verify signatures plus metadata checksums. Upload **the setup EXE, its `.blockmap`, `latest.yml`, and SHA256SUMS.txt together** to a draft GitHub release targeting the tested source commit. Verify assets, then publish as a stable release. Never publish metadata that points to a missing installer. Build commands use `--publish never` so upload remains a separate step. Future versions must keep the app ID, publisher, and feed stable. The original portable version cannot update itself; users install the setup once to migrate.

Relevant checks: `node --test test/updates.test.js`, `node scripts/update-smoke.mjs`, `node scripts/verify-release.mjs`, and the normal UI suite. `node scripts/update-download-smoke.mjs` downloads the real signed installer from a local fixture, validates it through electron-updater, and checks the on-quit installer arguments with process spawning intercepted. Add `--github` after publication to verify the public feed and download instead. These checks never run setup or replace a user installation. A full installed-to-installed migration still needs a separate Windows test environment; never invent an update version on the production feed just to test it. See [electron-builder v26 auto-update documentation](https://www.electron.build/v26/docs/features/auto-update/).

## Publishing changes

Review `git diff --cached` and `git status`. Never stage test outputs, recordings, generated speech, embeddings/models, settings or signing material. Force-adding files bypasses `.gitignore`. Use synthetic event fixtures and redact private data in reports. See [Privacy](privacy.md).

Source uses the MIT license; dependencies and downloaded models retain their own licenses.

## Tablet / LAN sharing

`src/network.js` enumerates private IPv4 interfaces; `src/server.js` binds loopback unless `lanEnabled` is explicitly true. LAN mode accepts private/loopback client addresses and exact enumerated Host headers; WebSocket Origin must match the requested origin. Tokens remain mandatory for pages, media and snapshots. The main process caches locally generated QR images and exposes them only to the trusted control window. No settings or control routes are served. Network changes require toggling sharing to refresh addresses. `tablet=1` selects a dark responsive shell in the shared overlay; it does not add an audio player.

Run `node --test test/network.test.js test/server.test.js` and `node scripts/tablet-smoke.mjs` (requires a private IPv4 interface and `npx playwright install webkit`). The smoke test uses temporary profiles, WebKit at tablet/phone sizes, real LAN-address HTTP/WebSocket access, and verifies toggle persistence, QR generation, chat/alerts, disconnects and unchanged transparent localhost rendering. It cannot prove that a separate physical iPad can cross the user's firewall or Wi-Fi client isolation.

QR generation uses [node-qrcode](https://github.com/soldair/node-qrcode) locally. Release checks and privacy auditing apply to tablet URLs/QR screenshots as they do to OBS source tokens: never publish a real user's access link.
