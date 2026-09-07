# Runecall

Digitales Stichkartenspiel für PC und Handy. Vor jeder Runde sagst du exakt
voraus, wie viele Stiche du gewinnen wirst — und musst danach genau diese Zahl
treffen. Ein Stich zu viel ist genauso schlecht wie einer zu wenig.

Die Regeln folgen dem klassischen, gemeinfreien Stichansage-Prinzip
(*Oh Hell*, auch *Blackout* oder *Stiche raten*), erweitert um zwei
Sonderkarten: den **Magier**, der jeden Stich gewinnt, und den **Narren**, der
keinen gewinnen will.

**Status:** Spielbar am PC. Eine vollständige Partie gegen Computergegner
läuft im Browser, in einem violetten Raum mit Tisch: Die Mitspieler sitzen
ringsum, in der Mitte wächst der Ablagestapel. Das Menü führt durch beide
Spielarten — die gewertete Partie aus der Spielersuche (fest 4 Spieler, 8
Runden, Rangpunkte) und den eigenen Raum mit Code, in dem alles frei
einstellbar ist. Es fehlen: das Handy-Layout für diesen Raum, Ton und das
Netzwerk — bis es steht, findet die Spielersuche niemanden und die Bots
übernehmen die freien Plätze.

```bash
npm install && npm run dev
```

## Was es werden soll

- **3–6 Spieler**, gegen Computergegner oder online
- **PC und Handy**, mit je eigenem Layout, in derselben Partie
- **Comichafter Stil**, 60 einzeln gestaltete Karten, vier Farben mit Runensymbolen
- **Deutsch und Englisch**
- Ausgeliefert als **Windows-Anwendung** und als installierbare **PWA** fürs Handy

## Aufbau

```
packages/
  engine/   Regeln. Kein DOM, kein Netzwerk, deterministisch.
  bots/     Computergegner in drei Stufen. Sehen nur die eigene Hand.
  client/   Vite-App: Oberfläche für PC und Telefon.
prototypen/ Wegwerf-Versuche, unabhängig vom Spiel.
```

Die Engine läuft an drei Stellen — in den Tests, im Client und später im
Server. Deshalb ist sie ein eigenes Paket und kennt weder Browser noch
Netzwerk. Aus demselben Grund bekommen die Bots nur `playerView` zu sehen:
ein Gegner, der alle Hände kennt, wäre kein Gegner.

| Befehl | Was passiert |
|--------|--------------|
| `npm run dev` | Das Spiel auf localhost. Auch vom Telefon im selben WLAN erreichbar. |
| `npm test` | Regeltests, Zufallspartien gegen die Invarianten, Bot-Prüfungen. |
| `npm run demo` | Eine komplette Bot-Partie als Text. `npm run demo -- 6 4711 hard` für Spielerzahl, Startwert und Stufe. |
| `npm run typecheck` | Strenge TypeScript-Prüfung über alle drei Pakete. |
| `npm run cards` | Bereitet die Kartenmotive aus `assets/` für den Client auf. `-- --kontakt` legt zusätzlich Kontaktbögen zum Nachprüfen an. |
| `npm run build` | Auslieferbares Verzeichnis unter `packages/client/dist`. |

## Kartenmotive

Das Bildmaterial liegt unter `assets/cards/<Set>/`, so wie es aus der
Erzeugung kommt: mehrere Karten je Bogen, Dateinamen ohne Aussage. Welcher
Bogen welche Karten enthält, steht daneben in `sheets.json` — der Dateiname
verrät es nicht, also muss es einmal jemand aufschreiben.

`npm run cards` schneidet die Bögen an den durchsichtigen Lücken auseinander,
benennt jede Karte nach ihrem Wert und legt sie einheitlich als WebP unter
`packages/client/public/cards/` ab. Für Karten ohne Motiv zeichnet der Client
weiter seine typografische Fassung — ein unvollständiges Set macht keine
Partie unspielbar.

**Standard Set:** vollständig — alle 60 Karten plus Rückseite.

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
| [docs/07-KARTEN-PROMPTS.md](docs/07-KARTEN-PROMPTS.md) | Prompts für alle 61 Kartenmotive des Standardsets, plus der Vertrag für spätere Kartensets. |
| [docs/08-TISCHANSICHT.md](docs/08-TISCHANSICHT.md) | Umbau der Oberfläche zum Raum mit Tisch: Stufenplan, Technikwahl, Abgrenzung. |

## Nächster Schritt

Stufe 7 aus [docs/08-TISCHANSICHT.md](docs/08-TISCHANSICHT.md): das Handy auf
den Raum umstellen, die Leistungsgrenze messen und den Ton an die
vorbereiteten Anschlusspunkte hängen. Danach die PWA — installierbar auf dem
Startbildschirm, ohne Adresszeile — und der Server für Online-Partien; die
Bots übernehmen dort leere und getrennte Plätze, ohne dass sich etwas an ihnen
ändert.
