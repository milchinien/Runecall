# Runecall

Digitales Stichkartenspiel für PC und Handy. Vor jeder Runde sagst du exakt
voraus, wie viele Stiche du gewinnen wirst — und musst danach genau diese Zahl
treffen. Ein Stich zu viel ist genauso schlecht wie einer zu wenig.

Die Regeln folgen dem klassischen, gemeinfreien Stichansage-Prinzip
(*Oh Hell*, auch *Blackout* oder *Stiche raten*), erweitert um zwei
Sonderkarten: den **Magier**, der jeden Stich gewinnt, und den **Narren**, der
keinen gewinnen will.

**Status:** Konzept abgeschlossen, alle 45 Entscheidungen getroffen. Noch kein Code.

## Was es werden soll

- **3–6 Spieler**, gegen Computergegner oder online
- **PC und Handy**, mit je eigenem Layout, in derselben Partie
- **Comichafter Stil**, 60 einzeln gestaltete Karten, vier Farben mit Runensymbolen
- **Deutsch und Englisch**
- Ausgeliefert als **Windows-Anwendung** und als installierbare **PWA** fürs Handy

## Dokumente

| Datei | Inhalt |
|-------|--------|
| [docs/00-ENTSCHEIDUNGEN.md](docs/00-ENTSCHEIDUNGEN.md) | **Alle getroffenen Entscheidungen** — der maßgebliche Stand. |
| [docs/01-REGELWERK.md](docs/01-REGELWERK.md) | Die Spielregeln, implementierungsgenau. Mit Sonderfällen, Beispielen als Testfälle und Invarianten. |
| [docs/02-SPIELBESCHREIBUNG.md](docs/02-SPIELBESCHREIBUNG.md) | Was das Spiel sein soll: Modi, Ablauf aus Spielersicht, Oberfläche. |
| [docs/03-OFFENE-FRAGEN.md](docs/03-OFFENE-FRAGEN.md) | Fragerunde 1 — welche Alternativen zur Wahl standen. |
| [docs/04-TECHNIK-EMPFEHLUNG.md](docs/04-TECHNIK-EMPFEHLUNG.md) | Begründete Stack-Wahl und die Schrittfolge bis zur fertigen App. |
| [docs/05-OFFENE-FRAGEN-RUNDE-2.md](docs/05-OFFENE-FRAGEN-RUNDE-2.md) | Fragerunde 2 — Online, Handy, Grafik, Name. |
| [docs/06-RECHTLICHES.md](docs/06-RECHTLICHES.md) | Was frei ist (die Regeln) und was nicht (fremde Namen und Bilder). |

## Nächster Schritt

Die Regel-Engine: Kartendeck, Stichauswertung, Ansagen, Wertung — ohne
Oberfläche, ohne Netzwerk, dafür mit Tests und einer Textausgabe, in der eine
komplette Partie Zug für Zug nachlesbar ist.
