# Technik-Empfehlung

Du hast gesagt: **echte App ohne Browser**, aber **während der Entwicklung im
Browser über localhost**, dazu **Online-Multiplayer** und **Handy-tauglich**.
Das ist eine ungewöhnlich präzise Anforderungskombination — und sie hat genau
eine offensichtlich richtige Antwort.

---

## Die kurze Fassung

**Eine einzige Web-Codebasis in TypeScript, die überall dieselbe ist, und je
Plattform eine andere Hülle drumherum.**

```
                 TypeScript-Codebasis
                          │
      ┌───────────────────┼───────────────────┐
      │                   │                   │
  Entwicklung          Windows              Handy
  localhost         Tauri-Fenster        PWA, später
  im Browser        (echte .exe)         echte App
```

Der Grund, warum das nicht nur bequem, sondern die sachlich richtige Wahl ist:
Bei einer nativen Umsetzung (C#/.NET, Python) müsstest du für Windows und Handy
zwei getrennte Oberflächen bauen und pflegen — und die Entwicklung im Browser
über localhost wäre gar nicht möglich. Eine Web-Codebasis erfüllt alle drei
Anforderungen gleichzeitig, ohne dass etwas doppelt existiert.

---

## Die Bausteine

### Kern — TypeScript, strict

Wie in Wavebreaker und Chromatic: `strict`, `noUncheckedIndexedAccess`,
ES2022, `verbatimModuleSyntax`. Keine Abweichung von deinem bisherigen Setup.

### Build — Vite

`npm run dev` startet localhost mit sofortigem Neuladen. Das ist der
Entwicklungsmodus, den du wolltest.

### Oberfläche — HTML/CSS statt Canvas

Für ein Kartenspiel ist normales HTML mit CSS die bessere Wahl als eine
Zeichenfläche: Das responsive Layout für Handy und PC fällt fast von selbst ab,
Text ist immer scharf, und die Bedienung funktioniert ohne Extraarbeit auch
mit Tastatur oder Screenreader. Kartenanimationen laufen über CSS-Transforms —
für Fächern, Gleiten und Umdrehen völlig ausreichend und flüssig auch auf
schwachen Telefonen.

Ob ein UI-Framework dazukommt oder es wie bei Wavebreaker beim direkten
Umgang mit dem DOM bleibt, ist noch offen (Frage 2.10).

### Struktur — vier Pakete in einem Verzeichnis

```
runecall/
├─ packages/
│  ├─ engine/    Regeln. Kein DOM, kein Netzwerk, deterministisch.
│  ├─ bots/      Computergegner. Nutzt engine.
│  ├─ client/    Vite-App: Oberfläche, Grafik, Ton.
│  ├─ protocol/  Was Client und Server einander sagen. Nur Typen.
│  └─ server/    Cloudflare Worker für Online-Partien. Nutzt engine + bots.
```

Der springende Punkt: **`engine` läuft an drei Stellen** — in den Tests, im
Server und im Client. Deshalb muss sie ein eigenes Paket sein und darf weder
DOM noch Netzwerk kennen. Genau das ist auch die Voraussetzung dafür, dass
Bots tausende Partien in Sekunden durchsimulieren können.

### Online — eigener Server, autoritativ

*Gebaut. Aus dem Node-Prozess wurde ein Cloudflare Worker mit einem Durable
Object je Raum — derselbe Aufbau, nur dauerhaft kostenlos zu betreiben. Die
Einzelheiten stehen in [09-ONLINE.md](09-ONLINE.md).*

Ein Node-Prozess mit WebSocket-Verbindungen. Der Server hält den echten
Spielzustand und schickt jedem Client **nur dessen eigene Hand** plus die
öffentlichen Informationen: Ansagen, Stichzähler, gespielte Karten, Trumpf.

Das ist bei einem Spiel wie Runecall nicht optional. Ein Client, der alle Hände kennt, ist ein
Client, mit dem man perfekt spielt. Ebenso prüft der Server jeden Zug gegen die
Bedienpflicht — die Prüfung im Client ist reine Bequemlichkeit für den Spieler,
nicht die Absicherung.

Praktischer Nebeneffekt: Weil Server und Bots dieselbe Engine benutzen, kann
ein Bot jederzeit einen leeren oder getrennten Platz übernehmen.

### Windows-App — Tauri 2

Verpackt die Web-Oberfläche in ein echtes Fenster mit eigener `.exe`, ohne
Browserleiste. Etwa 5 MB statt der rund 120 MB, die Electron braucht, weil es
das bereits in Windows vorhandene WebView nutzt.

*Voraussetzung:* Rust-Toolchain — auf deinem Rechner noch nicht installiert.
Das wird aber erst am Ende gebraucht, nicht zum Entwickeln.

### Handy — zuerst PWA, später echte App

**PWA (Progressive Web App)** heißt: Die Seite lässt sich vom Telefon aus auf
den Startbildschirm legen und startet danach im Vollbild, ohne Adresszeile und
ohne Browserrahmen. Für den Nutzer sieht das aus wie eine App. Kosten: fast
keine — eine Konfigurationsdatei und ein Icon-Satz, keine zusätzliche
Werkzeugkette, kein App-Store.

Wenn später eine echte, im Store installierbare App gewünscht ist, kommt
**Capacitor** oder **Tauri Mobile** dazu — dieselbe Codebasis, nur eine andere
Hülle.

*Zu iOS ehrlich gesagt:* Eine iPhone-App zu bauen braucht einen Mac und ein
Apple-Entwicklerkonto für rund 99 Euro im Jahr. Vom Windows-Rechner aus geht
das nicht. Auf dem iPhone bliebe es also bei der PWA — die dort funktioniert,
aber mit ein paar Einschränkungen.

### Zufall — seed-basiert

Kein `Math.random()` in der Engine, sondern ein eigener Generator mit
festem Startwert. Damit ist jede Partie exakt wiederholbar, was das Nachstellen
von Fehlern („in Runde 7 stimmte die Wertung nicht“) überhaupt erst möglich
macht. Bei Online-Partien vergibt der Server den Startwert.

---

## Was das über die Zeit bedeutet

| Schritt | Was entsteht | Rust/Android nötig? |
|---------|--------------|---------------------|
| 1 | Engine + Tests + Textausgabe | nein |
| 2 | Bots | nein |
| 3 | Oberfläche, spielbar auf localhost gegen Bots | nein |
| 4 | Handy-Layout, PWA-fähig | nein |
| 5 | Server, Online-Partien — **gebaut**, siehe [09-ONLINE.md](09-ONLINE.md) | nein |
| 6 | Windows-`.exe` | **Rust** nachinstallieren |
| 7 | Android-App im Store | **Java + Android-SDK** nachinstallieren |

Die ersten fünf Schritte laufen komplett mit dem, was bereits auf deinem
Rechner ist. Erst ganz am Ende muss etwas dazukommen — und auch nur, wenn du
die Store-Variante wirklich willst.

---

## Warum nicht die Alternativen

**C# / .NET** — .NET 8 ist installiert, und für eine reine Windows-Anwendung
wäre es eine gute Wahl. Aber es gibt keinen sinnvollen Weg zu einer
Handy-Version, und im Browser auf localhost testen kannst du auch nicht. Zwei
deiner drei Anforderungen fallen weg.

**Electron statt Tauri** — funktioniert genauso, aber jede Installation wiegt
rund 120 MB statt 5 MB, weil ein kompletter Chrome mitgeliefert wird. Für ein
Kartenspiel schwer zu rechtfertigen.

**Reine Website ohne App-Hülle** — wäre am einfachsten, erfüllt aber deine
Anforderung „echte App ohne Browser“ nicht. Die PWA ist der Kompromiss dazwischen:
sieht aus wie eine App, kostet fast nichts.

**Godot oder eine andere Spiel-Engine** — kann alle Plattformen, wäre aber für
ein Kartenspiel mit viel Text und Zahlen ein Rückschritt: Menüs, Tabellen und
Bedienelemente müsstest du von Hand nachbauen, die es im Browser geschenkt gibt.
