# Sidecast performance and Claude review — 2026-11-19

## Measurement

`node scripts/performance.mjs before` ran before changes; `node scripts/performance.mjs final` ran after fixes. Each run uses a separate Electron profile and local Streamer.bot WebSocket fixture. Twenty batches of 50 messages are sent 25 ms apart, with a 3-second quiet baseline. Chromium Performance metrics measure the control renderer's TaskDuration; this is not whole-system CPU or game FPS.

| Metric | Before | After |
| --- | ---: | ---: |
| Messages ingested | 1,000 | 1,000 |
| UI snapshot deliveries | 1,000 | 10 |
| Renderer task time during load and settling | 999 ms | 56 ms |
| Time through last message rendered | 991 ms | 527 ms |
| Preview DOM mutations during load | 7,977 | 592 |
| Quiet preview mutations / 3 seconds | 18 | 0 |

Single-run measurements are machine-dependent; the improvements were also observed in an intermediate run (55 ms). The benchmark asserts total ingestion and bounded history. Raw local results are in ignored `test-results/performance-*.json`.

## Implementation

- Rendering and browser-source serialization coalesced at 50 ms, while event ingestion, moderation and alert queuing remain synchronous.
- Hidden/minimized controls and hidden desktop overlays skip IPC; show/restore sends current state.
- No idle Hub interval or renderer repaint interval. Alerts and fading messages schedule their next expiry.
- CSS properties and activity DOM only rebuilt when their inputs change. Existing message nodes retained.
- No JSON serialization when there are no browser-source clients.
- Resize grip sends at most once per animation frame, with no full snapshot response.

## Actual Claude review

Claude Code was invoked locally with the authenticated account, model `claude-sonnet-5-5`, in read-only mode with source supplied through stdin. No user settings, credentials or Streamer.bot data were supplied. The initial default model was unavailable due to usage credits; Sonnet completed successfully. The original result is saved separately in `docs/claude-review.md`.

Confirmed issues fixed: duplicate publications, hidden-window work, repaint polling, unnecessary activity rebuilding, programmatic resize persistence, final bounds flush on quit, stale settings reverting overlay lock/visibility, redundant shortcut/window operations on profile save, null/array settings recovery, startup save errors, missing warning propagation, resize IPC load, and stale/subscription-error connection status.

Review corrections and scoped decisions:

- Source serialization was already once per broadcast, not once per WebSocket client. Now it is also batched and skipped without clients.
- Keep bounded full history in snapshots so platform/profile changes can immediately reveal existing messages; do not trim globally before filtering.
- Emoji/emote offset suggestion was explicitly unconfirmed. No index-unit conversion applied without an actual Streamer.bot payload proving it necessary.
- Existing HTTPS images are supplied by trusted local Streamer.bot/platform metadata; a speculative CDN allowlist would risk breaking legitimate providers. No arbitrary remote HTML is rendered.
- Loopback token rotation UI is an optional future feature; it is outside this optimization. URLs remain stable for OBS.
- The shutdown-blocking claim was unconfirmed: Electron documents that `session-end` cannot be prevented. No speculative lifecycle change was made.

## Validation

25 Node tests plus actual Electron UI and restart checks. Added regressions cover burst delivery with full ingestion, precise queued-alert deadlines, null settings recovery, subscription-error visibility, stale lock-state preservation, fade expiry without new traffic, hidden-window refresh, resize persistence on immediate quit, and preserving settings after an I/O read failure.

Claude's follow-up reported no remaining high or medium findings. Its confirmed low-priority settings-read issue was subsequently fixed: an unreadable file, or malformed file that cannot be backed up, blocks persistence for the current session and displays a restart notice. Save errors are separate from loader notices and clear after a successful save. Renderer sends tolerate closing frames; the preview alert meter is rebuilt with its current time offset after switching back from chat-only mode. Other speculative notes are retained in the original report, not represented as reproduced bugs.

References: [Electron window events](https://www.electronjs.org/docs/latest/api/browser-window/), [Certum signing and verification instructions](https://files.certum.eu/documents/manual_en/CS-Code_Signing_in_the_Cloud_Signtool_jarsigner_signing.pdf).

Release verification: signed unpacked 0.1.1 passes the complete Electron suite. The signed portable launcher passes scripts/portable-smoke.mjs (isolated profile, extraction, app start, HTTP browser source and chat rendering). Direct electron.launch on the NSIS wrapper timed out because inspector stderr is not forwarded; the dedicated test connects through an explicit local CDP port. Both executables verify as Valid with Certum timestamp; signtool reports zero warnings/errors. The artifact checksum is in release/Sidecast-0.1.1-verification.txt.


## 0.2.0 final measurement

After the new audio/highlight/viewer features: 1,000 synthetic messages, 10 UI deliveries, 603 DOM mutations, 63 ms renderer task time, 530 ms catch-up. Three quiet seconds: zero deliveries, zero mutations, zero renderer task time. Audio-disabled profiles allocate no audio-player renderer. Qwen is optional and measured separately (about 28–33 s cold, 5.4 s warm for the tested short phrases); it auto-unloads after 60 s idle. No game FPS or VRAM-contention guarantee. Final signed packaged UI/audio tests and portable launcher smoke passed; 39 Node tests and two Python protocol tests passed. Actual Claude reviews and resolutions are in the feature and viewer review documents.


### 0.2.3 appearance verification

Local load test on 2026-11-20 after adding per-output appearance: 1,000 events, 10 UI updates, 66 ms renderer task time, 523 ms catch-up. Three idle seconds: zero UI updates, zero DOM mutations, 0 ms measured renderer task time. Uses the existing isolated synthetic workload; no claim about game FPS. Raw results: `test-results/performance-appearance.json`.
