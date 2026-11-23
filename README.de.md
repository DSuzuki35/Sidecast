# Sidecast

**Your chat. In the game.** Ein lokales Windows-Overlay für Streamer.bot mit vier Themes, animierten Alerts und transparenten OBS-Browserquellen. Die gesamte App ist auf Englisch; Test-Alerts verwenden **balkn**.

Dieses Repository enthält Quellcode und App-Grafiken. Persönliche Stimmaufnahmen, generierte Sprachclips, Voice-Modelle, Zugangsdaten und Nutzerprofile sind nicht enthalten. Für „My voice“ wählst du deine eigene Aufnahme lokal in der App aus. Die `.gitignore` schließt diese privaten Daten und Testausgaben vom normalen Git-Upload aus.

## Starten

Die portable Windows-Datei liegt nach `npm run dist` unter `release/Sidecast-0.2.8-portable.exe`. Kein Installer nötig. Alternativ `release/win-unpacked/Sidecast.exe` mit dem gesamten zugehörigen Ordner verwenden.

Aus dem Quellcode (Node.js 24 LTS):

```powershell
npm ci
npm start
```

## Mit Streamer.bot verbinden

1. Streamer.bot starten und die gewünschten Streaming-Plattformen dort verbinden.
2. Unter **Servers / Clients → WebSocket Server** den Server starten. Standard: `127.0.0.1`, Port `8080`.
3. In Sidecast unter **Connection** Host, Port und gegebenenfalls das Passwort eintragen; **Connect** anklicken.
4. Optional **Connect automatically on startup** aktivieren. Sidecast abonniert die von deiner Streamer.bot-Version unterstützten Events automatisch. Zusätzliche Actions sind nicht nötig.

Sidecast unterstützt aktuelle Streamer.bot-1.0.x-Event-Strukturen sowie ältere Twitch-Chat-Payloads. Referenzen: [WebSocket-Konfiguration](https://docs.streamer.bot/api/websocket/guide/configuration), [Events](https://docs.streamer.bot/api/websocket/events), [offizieller JavaScript-Client](https://streamerbot.github.io/client/).

## Chat und Alerts

- Twitch-, YouTube- und Kick-Chat mit Plattform-Icons, Nutzerfarben und verfügbaren Badge-/Emote-Metadaten. Nachrichten bleiben Text, HTML wird nicht ausgeführt. Native Twitch-Emotes sowie globale und kanalspezifische Emotes von BetterTTV, FrankerFaceZ und 7TV werden unterstützt; bei Fehlern bleibt der Text lesbar.
- Twitch: Follows, Subs, Resubs, Gift Subs/Gift Bombs, Raids, Cheers.
- YouTube: neue Subscriber, Members/Membership-Milestones, Membership Gifts, Super Chats und Super Sticker.
- Kick: Follows, Subs, Resubs, Gift Subs/Mass Gifts und Kicks.
- Für Kicks gibt es noch kein vollständiges öffentliches Streamer.bot-Schema; fehlen Betragsdaten, erscheint ein allgemeiner Support-Alert.
- Alle Events stammen aus Streamer.bot. Verfügbarkeit und Liefergeschwindigkeit hängen von Plattform, Berechtigungen und Streamer.bot ab.
- Alert-Typen einzeln schalten und ihre Dauer jeweils zwischen 3 und 30 Sekunden einstellen. Alerts laufen nacheinander in Ankunftsreihenfolge (FIFO), maximal 50 warten; nach 2 Minuten verfällt ein wartendes Event; diese Frist pausiert während Audio-Vorbereitung und -Wiedergabe. Laufende Alerts behalten ihre gestartete Dauer. Längere Sprachausgabe verlängert die Anzeige automatisch.
- **Test-Chat/Test-Alerts erscheinen auch im Desktop-Overlay und in OBS.** Sie tragen ein TEST-Label. Beim Verbinden mit Streamer.bot werden bestehende Tests entfernt. Papierkorb leert den lokalen Chat und die Alert-Queue.

## Dein Look

**Grid / iRacing**, **Endurance / Le Mans Ultimate**, **Vice / GTA6** sind eigene, von den Spielen inspirierte Designs ohne offizielle Spielelogos. **Minimal** bietet zusätzlich einen kompakten, monochromen Look ohne Glow und dekorativen Hintergrund. Themes werden manuell gewählt, es gibt keine Spiel- oder Telemetrieerkennung.

Akzentfarbe, Schriftgröße, Hintergrunddeckkraft, Abstände, Rundungen, Nachrichtenzahl, Ausblendzeit, Zeitstempel, Badges und Plattformfilter sind anpassbar. Über **New profile** den aktuellen Look kopieren und benennen. Das aktive Profil gilt für Desktop und Browserquellen.

Unicode-Emojis unterstützen auch Hauttöne, Flaggen und zusammengesetzte Familien-Emojis. Reine Emoji-Nachrichten werden größer dargestellt. **Message highlights** hebt konfigurierte @Erwähnungen, ausgewählte Namen und Moderatoren hervor. Namen werden ohne Groß-/Kleinschreibung anhand des Anzeigenamens erkannt, plattformübergreifend; das ist keine Identitätsprüfung.

Die vier Themes besitzen eigene Chat-/Alert-Details: Grid mit Timing-Look und Zielflagge, Endurance mit gelbem Pitwall-Design, Vice mit Pink/Cyan und Sonnenuntergang-Linien, Minimal monochrom. Kontinuierliche Superellipse-Ecken werden verwendet, wenn der Browser `corner-shape` unterstützt; ältere OBS-Versionen erhalten normale Rundungen. Radius 0 bleibt eckig.

Unter **Studio → Viewer counts** die Zuschaueranzeige aktivieren und **Twitch** / **YouTube** separat wählen. Die Auswahl ist unabhängig von Chat-Plattformfiltern und wird pro Profil gespeichert. Die Titelzeile bleibt mit aktiven Zählern auch ohne Chatnachrichten sichtbar. `—` bedeutet noch keine Daten bzw. Verbindung unterbrochen; eine gemeldete 0 bleibt 0. Zahlen sind der zuletzt von Streamer.bot gemeldete Stand, keine Chatteilnehmerzahl. Mehrere von Streamer.bot überwachte YouTube-Broadcasts werden addiert; beendete Broadcasts werden entfernt. Kein Polling oder Zusatz-Plugin nötig; nach dem Verbinden auf das erste Statistik-Event warten. Quellen: [Twitch ViewerCountUpdate](https://docs.streamer.bot/api/websocket/events/twitch/viewer-count-update), [YouTube StatisticsUpdated](https://docs.streamer.bot/api/websocket/events/youtube/statistics-updated).

Unter **Alerts & Events → Alert placement** steuert die Browser-Darstellung, welche Quelle Alerts bekommt: **Compact · Chat source** zeigt kompakte Boxen in der Chat-Quelle, **Fullscreen · Alerts source** zeigt ausschließlich die separate Fullscreen-Quelle, **Both · Chat + Alerts sources** zeigt denselben Alert einmal pro Quelle. Fullscreen-Alerts erscheinen niemals im Desktop-Chatfenster oder in einer Chat-Browserquelle. Das Desktop-Overlay verwendet immer kompakte Boxen. Die separate Alerts-Quelle zeigt frei stehende Schrift und ein Icon mit transparenten Theme-Effekten; ohne Alert ist sie vollständig transparent.

## Sounds und Sprache

Unter **Alerts → Sounds & speech** Audio aktivieren, Ausgabe und Master-Lautstärke wählen. Pro Alert-Typ stehen Silent, Soft chime, Pulse, Fanfare oder eine eigene WAV-/MP3-/OGG-Datei (bis 20 MB), Lautstärke, **Read this alert aloud** und ein eigener Sprechtext zur Verfügung. Sound und Sprache laufen hintereinander, Alerts überlappen nicht. Platzhalter: `{name}`, `{detail}`, `{message}`, `{type}`, `{platform}`. Namen und Details stammen aus dem Event; für einen festen Wortlaut die entsprechenden Platzhalter entfernen.

- **Windows voice · lightweight** nutzt installierte Windows-Stimmen ohne Modell-Download.
- **My voice · Qwen (local AI)** nutzt das kostenlose Apache-2.0-Modell [Qwen3-TTS 0.6B Base](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base). Einmal **Install local voice engine**, danach eine eigene saubere WAV-Aufnahme (3–30 Sekunden) mit **Choose my recording** auswählen. Deutsch und Englisch sowie NVIDIA GPU oder CPU sind einstellbar. Die gewählte CPU-Option gilt auch beim Installieren. Installation benötigt mehrere GB; Aufnahmen bleiben lokal.
- Die eigene Stimme benötigt Rechenzeit. Gemessen auf diesem RTX-5090-PC: etwa 33 Sekunden mit kaltem Modell und 5,4 Sekunden für einen kurzen Folge-Alert. Das ist keine Echtzeitgarantie. Windows-Stimmen sind beim Spielen die sparsamere Wahl. Nach 60 Sekunden ohne Auftrag wird das KI-Modell entladen; **Unload model** geht sofort.
- Sprache wird vor der Anzeige vorbereitet; der nächste Alert wird während des aktuellen vorbereitet. Wiederholte Texte werden lokal zwischengespeichert (maximal 100 Sprachdateien). Leeren der Queue bricht laufende Vorbereitung ab.
- Für OBS **OBS audio source** wählen und **Copy OBS audio URL** verwenden. Diese URL genau einmal als separate Browserquelle hinzufügen und **Control audio via OBS** aktivieren. Chat-/Alert-Bildquellen bleiben stumm. Desktop-Wiedergabe und OBS-Quelle sind alternative Ausgaben, um doppelten Ton zu vermeiden.

**Test** bei einem Alert und **Test raid** sprechen jetzt auch dann, wenn automatisches Vorlesen für diesen Typ ausgeschaltet ist; **Enable alert audio** muss dafür eingeschaltet sein. Die Live-Schalter bleiben unverändert. Test-Alerts laufen weiterhin durch die normale Queue und sind auch in OBS sichtbar/hörbar, wenn OBS als Ausgabe gewählt ist.

**Voice preview** bietet ein eigenes Textfeld (bis 300 Zeichen), **Play voice preview** und **Stop preview**. Es verwendet die gewählte Stimme, Sprache und Master-Lautstärke, funktioniert auch bei ausgeschaltetem Alert-Audio und spielt ausschließlich lokal im Control Center. Der Text wird nicht als Alert veröffentlicht; die generierte temporäre WAV-Datei ist über die Medienquelle nicht abrufbar und wird nach dem Einlesen gelöscht. Lokale KI-Vorschau teilt sich den Generator mit Alerts und kann deren Vorbereitung verzögern.

Master- und einzelne Alert-Lautstärken reichen bis **150 %**, mit echter Web-Audio-Verstärkung in Desktop, OBS und Vorschau. Die beiden Regler multiplizieren sich. Raid-Namen bevorzugen den Raider gegenüber allgemeinen Nutzerfeldern und verwenden bei leerem Anzeigenamen dessen Login. Liefert Streamer.bot keinen Namen, wird keiner erfunden; TTS begrüßt neutral die raiding community.

**My voice · Chatterbox (expressive)** ergänzt eine zweite kostenlose lokale Engine (MIT). Unter **Sounds & speech → Speech engine** auswählen, bei Bedarf **Install Chatterbox voice engine** drücken. Dieselbe private WAV-Stimmaufnahme funktioniert für beide Engines. **Expressiveness** regelt die tatsächliche Modellbetonung von 0–100 %, Standard 50 %. Für lebhaftere Alerts zunächst 70–80 % probieren; Lautstärke bleibt separat. Deutsch und Englisch werden unterstützt. Höhere Werte verstärken Ausdruck, garantieren aber keine bestimmte Emotion. Vorschau und Alert-Test nutzen den eingestellten Wert. Chatterbox liegt getrennt unter `%LOCALAPPDATA%/Sidecast/chatterbox`, benötigt einen zusätzlichen Download und läuft anschließend offline. Beim Wechsel wird das vorherige AI-Modell entladen; maximal ein AI-Worker bleibt aktiv. Qwen bleibt unverändert auswählbar.

Angehängte Sub-/Resub-/Support-Nachrichten erscheinen vollständig in der Alert-Box, der Fullscreen-Alerts-Quelle und dem dauerhaften Chat-Eintrag. Beim Vorlesen wird die angehängte Nachricht automatisch an bestehende Ansagetexte angehängt. Mit **{message}** in der Vorlage lässt sich ihre Position festlegen. **{detail}** bleibt die Zusammenfassung, z. B. „12 months“. Die frühere 400-Zeichen-Kürzung entfällt: lokale AI erzeugt längere Ansagen abschnittsweise. Die bestehende Eingabegrenze für Chat-/Event-Text ist 4.000 Zeichen; expandierte Sprachvorlagen über 6.000 Zeichen werden mit einer Meldung abgewiesen statt unbemerkt gekürzt. Vollständige lange Nachrichten benötigen entsprechend Platz in der Quelle. TTS verlängert den Alert bis zum Ende der Ansage. Die Ablaufzeit wartender Alerts pausiert während Audio-Erzeugung und -Wiedergabe.

Audio ist standardmäßig ausgeschaltet. Falls der interne Audioplayer beim Laden scheitert, versucht Sidecast einmal einen Neustart mit einem frischen Fenster. Die Einstellungen bleiben gespeichert; ein dauerhaftes Audioproblem erscheint separat in Sounds & speech. Aus- und Einschalten von Audio startet einen weiteren Versuch. Persönliche Referenzaufnahmen liegen unter `%APPDATA%/Sidecast/audio/voice`, Sounds/Sprach-Cache unter `audio/media`; die Referenz wird niemals über die Browserquelle bereitgestellt. Das lokale KI-System liegt unter `%LOCALAPPDATA%/Sidecast/tts` und gehört nicht zur portablen EXE. `setup.log` und `worker.log` dort helfen bei Fehlern. Details und Quellen: [Local TTS engine](docs/tts-engine.md).

## Alerts im Chatverlauf

Jeder abgespielte Alert wird einmal als normaler Verlaufseintrag mit Name, Ereignistyp und Details in den Chat eingefügt. Der Eintrag entsteht beim Start des Alerts aus der Queue und bleibt nach Ablauf der Animation sichtbar. Neue Nachrichten verdrängen ihn nach dem eingestellten Nachrichtenlimit; **Fade after** gilt wie bei normalen Chatnachrichten. Bei **Never** bleibt er bis zum Herausscrollen bzw. Leeren des Chats erhalten.

Desktop-Overlay und Chat-Browserquelle zeigen denselben Verlauf. Die separate Fullscreen-Alerts-Quelle zeigt weiterhin nur die zeitlich begrenzte Einblendung. Verlaufseinträge erzeugen keine weitere Audio- oder TTS-Wiedergabe. Deaktivierte oder bereits in der Queue abgelaufene Alerts erzeugen keinen Eintrag; Chat leeren, Moderation und Testbereinigung entfernen entsprechende Einträge normal. Wie der übrige Chatverlauf werden sie beim Beenden verworfen.

## Twitch und Community-Emotes

Twitch-Emotes aus Streamer.bot, **BetterTTV**, **FrankerFaceZ** und **7TV** werden automatisch als Bilder angezeigt, einschließlich animierter Emotes und Zero-width-Effekte. Globale und im jeweiligen Kanal aktivierte Emotes werden unterstützt. Kanal-IDs kommen aus Streamer.bot, bei Shared Chat aus dem Ursprungskanal. Es braucht keine Browser-Erweiterung, zusätzlichen Streamer.bot-Actions oder eigenen API-Schlüssel. Emotes in YouTube/Kick-Metadaten bleiben unverändert unterstützt; die zusätzlichen Kataloge gelten für Twitch.

Die Kataloge laden beim ersten Twitch-Chat im Hintergrund; bis dahin bleibt der Text sichtbar. Bereits sichtbare Nachrichten werden nachgeladen. Gelöschte oder moderierte Nachrichten kommen dadurch nicht zurück. Kataloge werden 15 Minuten zwischengespeichert und bei weiterem Chat aktualisiert. Bei Anbieterfehlern bleibt der letzte gültige Stand erhalten; nach fünf Minuten darf erneut geladen werden. Emote-Namen sind groß-/kleinschreibungssensitiv und müssen als eigenes Wort geschrieben werden. Bilder kommen direkt von den Anbieter-CDNs; fehlt ein Bild, bleibt der Emote-Code lesbar. Kanal-Codes haben Vorrang vor globalen; bei Namenskonflikten zwischen Drittanbietern gilt 7TV → BTTV → FFZ. Von Streamer.bot gelieferte Bilder behalten Vorrang.

Technische Quellen und Prüfungen: [Emote support](docs/emotes.md).

## Darstellung pro Ausgabe

Unter **Studio → Output appearance** zunächst **Link both outputs** ausschalten. Über **Edit appearance for** zwischen **Desktop overlay** und **Browser source** wechseln. Theme, Akzentfarbe, Schriftgröße, Hintergrund, Abstände, Ecken, Top-Ausrichtung, Badges, Zeitstempel, Highlights, Viewer-Anzeige und Alert-Platzierung lassen sich getrennt einstellen. Die Vorschau zeigt die ausgewählte Ausgabe. Die Auswahl erscheint auch auf **Alerts & Events**. Erneutes Verknüpfen übernimmt die aktuell ausgewählte Darstellung für beide Ausgaben.

**Both · Chat + Alerts sources** bedeutet zwei getrennte OBS-Browserquellen: Chat mit kompakter Box und Alerts mit zentrierter Fullscreen-Einblendung. Beide zeigen denselben Queue-Eintrag mit derselben Laufzeit; Sound und TTS laufen einmal. Unter **Output appearance → Browser source** wird diese Verteilung eingestellt. Das Desktop-Fenster bleibt kompakt. Bei getrennten Darstellungen ist dessen Fullscreen-Auswahl deshalb deaktiviert.

Chat-Inhalte, Plattformfilter, Nachrichtenlimit, Fade-Dauer, aktive Alert-Typen, Alert-Dauern, Queue und Audio bleiben gemeinsam. Chat-, Alert- und kombinierte Browserquelle teilen dieselbe Browser-Darstellung. Bestehende Profile starten verknüpft mit ihrem bisherigen Look.

**Top aligned chat** hält die Titelzeile auch bei leerem Chat oben. Nachrichten wachsen darunter; bei vollem Fenster scrollt nur der Nachrichtenbereich. Kompakte Alerts stehen dann unter dem Chat, damit die Titelzeile nicht springt. **Font size** skaliert jetzt auch Titelzeile und Viewer-Zähler. Vice verwendet rauchige HUD-Flächen, zurückhaltende Akzente und kräftige weiße Alert-Schrift nach der bereitgestellten Referenz.

## Desktop-Overlay

**Open overlay** zeigt das transparente, rahmenlose Fenster. Im Bearbeitungsmodus oben ziehen und am unteren rechten Griff skalieren. **Lock overlay** aktiviert Click-through und gibt den Fokus ans Spiel zurück.

Standard-Hotkey: **Ctrl + Shift + Space**. Er schaltet die Sperre um. Hotkey und Always-on-top unter **Connection** ändern. Auch über das Windows-Tray lässt sich das Overlay entsperren, ein-/ausblenden und Sidecast beenden. Ein blockierter Hotkey wird angezeigt; beim App-Start ist das Overlay immer entsperrt. Ein verschobenes Fenster kann unter **Connection → Reset overlay position** zurückgeholt werden.

Ziel sind Spiele im **Fenster-/Borderless-Modus**. Exklusives Vollbild ist nicht unterstützt. Es findet keine Injektion ins Spiel statt. Das Schließen des Control Centers minimiert Sidecast ins Tray und lässt die Browserquellen weiterlaufen. Zum vollständigen Beenden den Power-Button oder das Tray-Menü verwenden.

## OBS-Browserquellen

Unter **Browser sources** die URL für **Chat** und **Alerts** kopieren. In OBS eine Browserquelle anlegen und die URL einfügen.

| Quelle | Empfohlene Größe |
| --- | --- |
| Chat | 400 × 650 |
| Alerts (Fullscreen) | Canvas-Auflösung, z. B. 1920 × 1080 |

Für beide Darstellungen **Both** auswählen und beide URLs als getrennte Browserquellen in OBS hinzufügen. Die Alerts-Quelle füllt das Canvas; die Chat-Quelle bleibt an ihrer gewünschten Position. Bestehende kombinierte URLs funktionieren weiter als Chat-Quelle mit kompakten Alerts. Hintergrund transparent lassen. Sidecast muss auf demselben PC laufen; das Desktop-Overlay darf verborgen sein. URLs bleiben über Neustarts erhalten, solange der Port gleich bleibt. Bei Portänderung die URL in OBS ersetzen. Standard-Port ist `3131`; bei Konflikten zeigt Sidecast einen Hinweis und bietet einen anderen Port an.

## Daten und Sicherheit

Einstellungen liegen in `%APPDATA%/Sidecast/settings.json`. Passwörter werden mit Electron safeStorage über Windows verschlüsselt; falls das nicht verfügbar ist, bleiben sie nur im Arbeitsspeicher. Browserquellen erhalten weder Passwort noch Verbindungseinstellungen. Der lokale Server bindet ausschließlich an `127.0.0.1`, prüft den URL-Token und bietet keine schreibende API. Die URL bitte wie einen privaten Zugriffsschlüssel behandeln.

Chatverlauf und Alerts werden nicht auf die Festplatte geschrieben; der Arbeitsspeicher-Verlauf ist auf 200 Nachrichten begrenzt. Profile sind auf 20 begrenzt. Es gibt keinen Sidecast-Account und keinen Cloud-Dienst. Externe HTTPS-Emote-/Badge-Bilder werden bei vorhandenen Metadaten vom jeweiligen Bildanbieter geladen.

## Entwickeln und prüfen

```powershell
npm test          # Datenmodelle, Events, Auth, lokaler HTTP/WebSocket-Server
node scripts/audio-smoke.mjs # Desktop-/OBS-Audio und TTS
node scripts/appearance-smoke.mjs # Getrennte Darstellung, Top-Ausrichtung, Speicherung
npm run test:ui   # Electron-End-to-end und Screenshots in test-results/
npm run pack     # Windows-App als Ordner
npm run dist     # Portable Windows-EXE
npm run dist:signed # Signierter Build mit SimplySign / Windows-Zertifikat
npm run test:performance -- local # Reproduzierbarer Lasttest mit 1.000 Nachrichten
```

Die UI-Prüfung verwendet einen separaten temporären Profilordner und einen freien Browserquellen-Port. Sie verändert keine persönlichen Streamer.bot- oder OBS-Einstellungen. Die App wird nicht automatisch mit einem realen Streamer.bot verbunden. Echter Live-Chat, OBS und konkrete Spiele benötigen einen abschließenden Test mit dem eigenen Setup.

Projektaufbau: `src/core/` enthält Ereignisnormalisierung, Profile und Zustand; `src/connection.js` die Streamer.bot-Verbindung; `src/server.js` die lokalen Browserquellen; `src/main.js` Fenster, IPC und Lebenszyklus; `public/` das gemeinsame UI. `build/` enthält das aus dem SVG-Logo erzeugte App-Icon.

## Signierter Windows-Build

SimplySign Desktop verbinden, dann `npm run dist:signed` ausführen. Das Skript wählt das einzige gültige Code-Signing-Zertifikat mit privatem Schlüssel im persönlichen Windows-Zertifikatspeicher. Bei mehreren Zertifikaten zuvor `SIDECAST_SIGNING_THUMBPRINT` setzen. Es werden keine Schlüssel exportiert oder Passwörter gespeichert. Die App und der portable Launcher erhalten SHA-256-Signaturen und einen RFC-3161-Zeitstempel von Certum. Der Build schlägt bei fehlender Signatur oder ungültiger Abschlussprüfung fehl. `npm run dist` bleibt für lokale unsignierte Entwicklungs-Builds verfügbar.

## Performance

Ereignisse werden sofort verarbeitet; Fenster und OBS-Quellen erhalten gebündelte Updates spätestens nach rund 50 ms. Verborgene App-Fenster erhalten beim Wiederanzeigen einen aktuellen Stand. Chat-Ausblendung und Alert-Wechsel verwenden gezielte Ablauf-Timer statt permanenter Polling-Schleifen. Nachrichtenelemente bleiben erhalten, die Activity-Liste wird nur bei geänderten Events neu aufgebaut.

Messung auf diesem PC mit 1.000 synthetischen Twitch-Nachrichten: 1.000 → 10 UI-Updates und 999 → 63 ms Renderer-Taskzeit (Version 0.2.0). Der Test prüft auch, dass alle 1.000 Ereignisse verarbeitet werden und die letzten 200 Nachrichten erhalten bleiben. Das ist ein lokaler Lasttest mit separatem Testprofil, keine FPS-Messung in einem Spiel. Details stehen in `docs/performance-review.md`.
