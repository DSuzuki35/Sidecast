# Sidecast

**Your chat. In the game.**

A local Windows overlay for Streamer.bot, with themed alerts, transparent OBS browser sources, and optional local voice cloning.

[User guide](docs/user-guide.md) · [Privacy](docs/privacy.md) · [Development](docs/development.md) · [Deutsch](README.de.md)

## Windows download

**[Download Sidecast 0.3.0 for Windows](https://github.com/DSuzuki35/Sidecast/releases/download/v0.3.0/Sidecast-0.3.0-Setup.exe)** — signed Windows x64 installer with automatic updates.

Quit any older Sidecast instance from the tray before installing. Your local settings and private voice stay on your PC. Installed copies check for updates at startup and every six hours, download them automatically, and install when you choose **Quit** from the tray. No automatic restart during your stream. **Connection → App updates** shows progress and offers a manual check. [Release notes and checksums](https://github.com/DSuzuki35/Sidecast/releases/tag/v0.3.0).

## Features

- Optional tablet/phone view over your local Wi-Fi, with a locally generated QR code.
- Resizable, borderless, always-on-top overlay with click-through mode.
- Grid (iRacing), Endurance (LMU), Vice (GTA6-inspired), and Minimal themes.
- Separate desktop/browser appearance with synchronized contents.
- Twitch, YouTube, and Kick chat/events through Streamer.bot.
- Native Twitch, BetterTTV, FrankerFaceZ, and 7TV emotes, including animation and zero-width layering.
- Twitch/YouTube viewer counts, top-aligned headers, emoji and highlights.
- Queued alerts with per-type durations and lasting chat-history entries.
- Full attached messages in chat, alerts and speech.
- Separate Chat and fullscreen Alerts browser sources.
- Custom sounds, volume up to 150%, Windows speech, local Qwen cloning, and local Chatterbox with an Expressiveness slider.

## Run from source

Use Windows x64 and Node.js 24 LTS. Connect your streaming accounts in Streamer.bot first.

```powershell
git clone https://github.com/DSuzuki35/Sidecast.git
cd Sidecast
npm ci
npm start
```

Start Streamer.bot's WebSocket server, then connect from Sidecast's **Connection** page. No extra Streamer.bot actions or plugins are required. See the [User guide](docs/user-guide.md).

## Build a Windows installer

```powershell
npm run dist
```

The output is `release/Sidecast-0.3.0-Setup.exe`. Signed builds use `release/0.3.0/` to avoid overwriting a running folder build. `npm run dist:portable` builds a portable EXE without automatic updates. Developer builds are unsigned unless you configure your own signing certificate. Prebuilt downloads are distributed through GitHub Releases, separately from the source tree.

## Your voice stays local

**No personal voice recording, generated speech sample, speaker embedding, user profile or credential is included in this repository.** Select your own local WAV recording to use “My voice.” Models are downloaded separately; supported speech generation then runs locally. Recordings, generated audio, models, settings and test outputs are excluded from normal Git tracking. See [Privacy](docs/privacy.md).

## Requirements and limits

- Desktop overlays target borderless/windowed games; exclusive fullscreen is unsupported.
- OBS sources run on this PC at `127.0.0.1`; Sidecast must stay running.
- Events depend on Streamer.bot and connected platform accounts.
- Local AI requires a separate multi-GB installation and processing time. Choose NVIDIA CUDA or CPU; Windows speech is the lighter option while gaming.
- The interface is English. Demo events use **balkn**.

## Development

```powershell
npm test
npm run test:ui
npm run test:performance -- local
```

See [Development](docs/development.md) for architecture, targeted checks and signing, and the [User guide](docs/user-guide.md#troubleshooting) for troubleshooting.

## License

Sidecast source is available under the [MIT License](LICENSE). Dependencies, emotes and downloaded models retain their own licenses. Game-inspired themes are original designs and do not imply affiliation with game publishers.
