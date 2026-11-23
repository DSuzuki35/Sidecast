# Emote support

Sources verified 2026-11-20:
- Streamer.bot event schema, broadcaster/sharedChatSource and emote ranges: https://docs.streamer.bot/api/websocket/events/twitch/chat-message
- Twitch CDN format and message fragments: https://dev.twitch.tv/docs/chat/send-receive-messages
- BetterTTV public API: https://betterttv.com/developers
- FrankerFaceZ enabled global/room sets: https://www.frankerfacez.com/developers and https://api.frankerfacez.com/
- 7TV v3 schema, active-emote zero-width flag 1 and file hosts: https://github.com/SevenTV/API/blob/main/internal/api/rest/v3/docs/swagger.json

The main process loads public catalogs lazily (three concurrent, eight channels, 8 MB per response, ten-second request timeout). Images use provider CDNs and normal Chromium image caching. No new interval timers or subscriptions. Native images remain authoritative; known third-party provider metadata may add zero-width presentation. Only individual message DOM nodes whose fragments changed are replaced.

Live validation: BTTV 65 globals (PNG CDN 200); FFZ 15 globals (PNG CDN 200); 7TV 45 globals (WebP CDN 200), plus 966 channel emotes in a public example channel. Counts are observations, not hardcoded. FFZ intermittently timed out during validation, then returned successfully; stale-cache/backoff behavior is covered separately. The injected Electron fixtures check all four providers, late enrichment, source isolation, native/browser/preview equality, zero-width geometry, moderation and fallback text without relying on external service availability.

Local performance (1,000 synthetic messages): 10 UI updates, 72 ms renderer task time, 552 ms catch-up. Three idle seconds: zero UI updates and DOM mutations. This is not a game-FPS benchmark.
