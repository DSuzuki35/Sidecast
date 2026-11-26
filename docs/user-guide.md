# Sidecast user guide

[Back to README](../README.md) · [Privacy](privacy.md) · [Development](development.md)

## Connect Streamer.bot

1. Start Streamer.bot and connect your Twitch, YouTube or Kick accounts there.
2. Start **Servers / Clients → WebSocket Server**.
3. In Sidecast **Connection**, match the host, port and optional password. Defaults: `127.0.0.1`, port `8080`.
4. Click **Connect**. Optionally enable **Connect automatically on startup**.

Events are subscribed automatically. No imported actions or additional Streamer.bot plugin are needed. Platform permissions remain managed in Streamer.bot. [Official WebSocket configuration](https://docs.streamer.bot/api/websocket/guide/configuration).

## Desktop overlay

In **Studio**, choose a theme and click **Open overlay**. Drag the edit bar to move it and use the bottom-right grip to resize it. **Lock overlay** enables click-through.

**Ctrl + Shift + Space** toggles the lock. The tray menu can also unlock the window. Configure the hotkey and always-on-top under **Connection**. **Reset overlay position** brings an off-screen overlay back.

Use borderless/windowed games; exclusive fullscreen is unsupported. Closing the control window leaves Sidecast running in the tray. Use the power button or tray Quit action to exit completely.

## OBS browser sources

Keep Sidecast running on the same PC as OBS. In **Browser sources**, copy each URL into an OBS Browser source:

| Source | Suggested dimensions | Contents |
| --- | --- | --- |
| Chat | 400 × 650 | Chat history and optional compact alert boxes |
| Alerts | Canvas size, e.g. 1920 × 1080 | Transparent fullscreen alerts |

Choose browser output under **Alerts & Events → Alert placement**:

- **Compact · Chat source:** temporary boxes in Chat only.
- **Fullscreen · Alerts source:** temporary alerts in the separate Alerts source only.
- **Both · Chat + Alerts sources:** the same event appears once in each source, synchronized.

Fullscreen alerts never appear in the desktop chat window or Chat browser source. An idle Alerts source is intentionally transparent. Played events also become chat-history entries independently of the temporary alert placement.

Visual sources are silent. For OBS audio, select **OBS audio source** under **Sounds & speech**, use **Copy OBS audio URL**, and add it once as a separate Browser source. Enable **Control audio via OBS**. Desktop playback and OBS audio are alternative outputs.

URLs include an access token: do not share them. They survive restarts, but changing the source port requires updating OBS. The desktop overlay may be hidden while browser sources remain active.

## Themes, profiles and appearance

| Theme | Inspiration |
| --- | --- |
| Grid | iRacing race control/timing |
| Endurance | Le Mans Ultimate pit wall |
| Vice | GTA6-inspired translucent HUD |
| Minimal | Restrained monochrome styling |

Themes are selected manually; there is no game/telemetry detection. Customize accent, font size, opacity, spacing, corners, badges, timestamps and platform icons. Font size affects the header and viewer counters. Superellipse corners use browser support when available, with ordinary rounded corners as fallback.

Disable **Studio → Output appearance → Link both outputs**, then use **Edit appearance for** to style desktop and browser separately. All visual browser sources share browser appearance. Contents, platform filters, message limit/fade, enabled alerts, durations and audio remain shared. **New profile** copies the current setup.

**Top aligned chat** keeps the header at the top, including when empty. **Viewer counts** shows Twitch and YouTube independently of chat filters. `—` means no current data; `0` means Streamer.bot reported zero. Monitored YouTube broadcasts are summed. Statistics come from Streamer.bot events, not chat-participant counting.

**Message highlights** emphasizes mentions, selected display names and moderators. Display-name matching is not identity verification.

## Chat, emotes and event history

Native Twitch emotes and BetterTTV, FrankerFaceZ and 7TV global/channel emotes load automatically. Channel emotes must be enabled for the broadcaster. Native metadata takes precedence; failed images fall back to text. See [Emote implementation](emotes.md).

In-memory history retains 200 entries, with a configurable visible limit of 1–100. **Fade after → Never** leaves entries until displaced or cleared. Played alerts become regular themed entries with sender, event details and attached message, remaining after the animation ends.

| Platform | Supported event families |
| --- | --- |
| Twitch | Follow, sub/resub, gift/gift bomb, raid, cheer |
| YouTube | Subscriber, member/milestone, membership gift, Super Chat/Sticker |
| Kick | Follow, subscription/renewal, gifts, Kicks |

Availability depends on Streamer.bot. Missing optional details receive a generic description. Bulk Twitch gift events suppress individual gifts identified as belonging to the same gift bomb.

Each type has an enable switch and a 3–30 second duration. Alerts play sequentially, with up to 50 waiting; overflow discards the oldest waiting entries. Stale events expire after two minutes, with expiry paused during audio preparation/playback. Speech may extend display duration.

Attached text is retained up to the existing 4,000-character event limit. Give long messages sufficient source space. Supported moderation events remove matching history and cancel matching attached-message alerts, including pending speech.

## Sounds and speech

Enable **Alerts & Events → Sounds & speech → Enable alert audio**. Per type, choose Silent, Soft chime, Pulse, Fanfare or a custom WAV/MP3/OGG up to 20 MB. Master and per-type volume each range from 0–150% and multiply together. Sound plays before speech.

| Engine | Voice | Setup |
| --- | --- | --- |
| Windows voice | Installed Windows system voice | No AI download |
| My voice · Qwen | Your recording | Install Qwen locally |
| My voice · Chatterbox | Your recording with expression control | Install Chatterbox locally |

For local AI:

1. Select the engine and NVIDIA GPU or CPU.
2. Click its install button and let the multi-GB download complete.
3. Choose your own clean WAV: 3–30 seconds, under 30 MB, one voice and minimal background noise.
4. Choose English or German.
5. Enter a sentence in **Voice preview** and press **Play voice preview**.

Both engines reuse the selected reference; it is not uploaded. First use loads the model and takes longer. Workers unload after 60 idle seconds; **Unload model** releases the active worker immediately. GPU synthesis competes with games/OBS for resources. Windows voices are the lighter option.

Chatterbox **Expressiveness** ranges from 0–100%. Start at 50% for natural delivery or try 70–80% for stronger expression. This controls delivery, not volume, and does not guarantee a particular emotion. Qwen cloning does not expose this slider.

Enable **Read this alert aloud** per type for real events. Spoken templates accept:

| Placeholder | Value |
| --- | --- |
| `{name}` | Sender/subscriber/raider |
| `{detail}` | Summary, e.g. `12 months` |
| `{message}` | Full attached viewer message |
| `{type}` | Normalized event type |
| `{platform}` | Platform name |

Example: `Welcome back {name}! {detail}. {message}`

If `{message}` is omitted, the attached message is appended automatically. Substitutions are literal text, not markup. Long AI speech is generated in chunks. Expanded speech over 6,000 characters is rejected with a visible error rather than silently shortened. A generation timeout can produce a visual alert without speech; check audio status. See [TTS internals](tts-engine.md).

## Test safely

**Send test chat** and alert tests appear in connected overlays and OBS, marked TEST. Alert Test includes speech when master alert audio is enabled, even if automatic speech for that type is off. It uses the normal queue and selected output. Clear tests before going live.

**Voice preview** accepts 300 characters and plays only in the control window, even with master alert audio off. It uses the selected engine, language, expression and master volume and does not create an OBS alert. **Stop preview** cancels it. Preview and live alerts share a generator, so previewing can delay an alert.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Cannot connect | Streamer.bot WebSocket server, host, port and password. Its default port is 8080; Sidecast sources default to 3131. |
| Connected but no messages | Platform connection in Streamer.bot, filters, and whether supported events arrive. |
| Blank OBS Chat source | Sidecast running, fresh copied URL, unchanged port; use Send test chat and refresh the source. |
| Blank OBS Alerts source | Transparency between events is expected. Check placement and use an alert test. |
| URL works in browser but not OBS | Check OBS browser-engine logs and duplicate OBS instances. Restart OBS yourself only when safe: it can interrupt streams/recordings. |
| Fullscreen alert missing | Add the separate Alerts source at canvas size; choose Fullscreen or Both. |
| History disappears | Message limit, Fade after, clearing or moderation. Never disables timed fading. |
| No sound | Master enable/volume, per-type sound/speech, selected output, OBS audio source and mixer. |
| Desktop audio loading error | Read Sounds & speech status; toggle alert audio off/on to retry. |
| AI fails or is slow | Engine installed, valid reference, GPU/CPU setting, resources and status error. Cold starts are slower. |
| Voice feels flat | Try Chatterbox at 70–80% or a cleaner/more expressive reference; compare in Voice preview. |
| Emote stays text | Exact code, channel enablement, catalog loading and provider availability. |
| Overlay stuck/off-screen | Unlock via hotkey/tray, Reset overlay position, and use borderless mode. |

AI runtime folders contain `setup.log` and `worker.log`. Read [Privacy](privacy.md) before sharing logs. Report app/Windows versions, affected output, reproduction steps and expected/actual behavior. Never attach source tokens, settings, voice recordings or complete user-data folders.

## Installation and updates

Download the signed Windows x64 setup from [GitHub Releases](https://github.com/DSuzuki35/Sidecast/releases/latest). Quit an older portable copy from its tray menu first, run setup, and choose an installation folder. Launch Sidecast from the Start menu or desktop shortcut. Existing settings, source URLs and locally selected voice are retained. The installer includes no personal recording, generated speech or downloaded AI models.

Installed copies check for stable updates at startup and every six hours, then download in the background. **Connection → App updates** shows the status and a **Check for updates** button. A ready update installs when you choose **Quit** from the tray. Closing the settings window only hides it; it does not install or restart anything. Start Sidecast normally next time. Offline checks fail without interrupting chat; retry when connected. Portable and source builds do not auto-update: install the setup once to enable this.

Windows Settings → Apps can uninstall Sidecast. Your settings and optional local AI data are kept so reinstalls can reuse them; see [Privacy](privacy.md) for manual data cleanup.

## iPad, tablet and phone over Wi-Fi (0.3.0)

1. Open **Browser sources → Tablet / LAN access** in Sidecast.
2. Enable **Share chat on my local network**. Sharing is off by default.
3. Scan the QR code with your iPad camera and open it in Safari, or use **Copy tablet URL**. If multiple network adapters appear, use the one connected to your tablet's network.

The page has a dark background, fits portrait and landscape, and shows live connection status. Chat, emotes and compact alerts follow the browser appearance settings; fullscreen alerts still belong to the separate Alerts source. The tablet does not play duplicate sound/TTS. OBS keeps its existing localhost URLs and transparent background. Disabling sharing disconnects tablet clients; the ordinary local sources remain available.

Keep the PC and Sidecast running. Both devices must be on the same LAN; a wired PC and wireless iPad on the same router also work. If Windows Firewall prompts, allow Sidecast on your trusted network. If it does not prompt and the iPad cannot connect, check Windows Security → Firewall & network protection → Allow an app through firewall, and allow the installed Sidecast app for the profile used by your trusted home network. Do not disable the firewall. Guest Wi-Fi or wireless client isolation may prevent devices from connecting. Router port forwarding is not required. Changing the PC's address requires toggling sharing off/on and rescanning the new QR.

The link contains the same access token as your browser sources. Anyone who has it and can reach the LAN service can read stream content, including attached alert messages and generated alert media. Keep it private. QR generation happens entirely on your PC. The private voice reference, settings and control API are never served.
