# Runecall — Spielbeschreibung (Produktvision)

Was dieses Dokument beschreibt: **was das PC-Spiel ist**, nicht wie die Regeln
funktionieren. Die Regeln stehen in [01-REGELWERK.md](01-REGELWERK.md).

Alles, was mit ❓ markiert ist, ist eine offene Entscheidung und in
[03-OFFENE-FRAGEN.md](03-OFFENE-FRAGEN.md) als Multiple-Choice-Frage gestellt.
Dieses Dokument beschreibt bewusst schon eine konkrete Fassung, damit man sieht,
worüber man entscheidet — es ist ein Vorschlag, kein Beschluss.

---

## 1. Der Kern in einem Satz

Ein digitales Stichansage-Spiel, bei dem man gegen Computergegner oder online den
Spannungsbogen des Originals erlebt: die Ansage als kleine Mutprobe, das
Ausspielen als ständiges Abwägen zwischen „Stich holen“ und „Stich vermeiden“,
und am Rundenende der Moment, in dem die Wertung aufgedeckt wird.

## 2. Was das Spiel gut machen muss

Drei Dinge entscheiden, ob eine Umsetzung dieses Spielprinzips Spaß macht:

**Die Ansage muss sich schwer anfühlen — aber nicht willkürlich.**
Der Spieler braucht beim Ansagen die richtigen Informationen auf einen Blick:
eigene Hand, Trumpffarbe, wer schon was angesagt hat, wie viele Stiche noch
„frei“ sind. Fehlt das, wird die Ansage zum Raten.

**Man muss jederzeit wissen, wo man steht.**
Das Wichtigste am ganzen Spiel ist die Zahl „noch X Stiche bis zur Ansage“.
Diese Information gehört prominent und dauerhaft ins Bild — für einen selbst
und für alle Gegner. Ein Spieler, der 0 angesagt hat und schon einen Stich hat,
ist eine dramatische Situation, und man muss sie sehen können.

**Die Gegner müssen glaubwürdig spielen.**
Ein Bot, der bei Ansage 0 seinen Magier wegwirft, zerstört die Illusion. Die
Bots müssen ihre eigene Ansage verfolgen, also aktiv Stiche vermeiden, wenn sie
schon genug haben. Das ist die Mindestanforderung; alles darüber ist Kür.

## 3. Spielmodi — entschieden

**Gegen Computergegner und online, dazu auf dem Handy bedienbar.**

- **Gegen Bots** — ein Mensch, 2–5 Computergegner. Immer verfügbar, ohne
  Verbindung, ohne Wartezeit. Das ist auch der Modus, der zuerst entsteht.
- **Online** — mehrere Menschen auf verschiedenen Geräten, freie Plätze
  wahlweise mit Bots aufgefüllt. PC und Handy in derselben Partie.

Die beiden Modi sind kein doppelter Aufwand, sondern bauen aufeinander auf: Die
Bots entstehen zuerst und liefern später die Gegner, mit denen online leere
Plätze gefüllt und abgebrochene Verbindungen überbrückt werden.

Offene Details dazu in [05-OFFENE-FRAGEN-RUNDE-2.md](05-OFFENE-FRAGEN-RUNDE-2.md),
Block G und H.

## 4. Bot-Stärke ❓

Angedacht sind drei Stufen, weil Bots für dieses Spiel erstaunlich unterschiedlich gut
sein können:

| Stufe      | Ansage                                                    | Ausspiel                                                                 |
|------------|-----------------------------------------------------------|--------------------------------------------------------------------------|
| Leicht     | grobe Heuristik über Kartenstärke                         | spielt regelkonform, aber ohne Rücksicht auf die eigene Ansage           |
| Normal     | Heuristik plus Trumpf- und Positionsbewertung             | verfolgt die eigene Ansage: will Stiche, wenn nötig; duckt sich, wenn nicht |
| Schwer     | Monte-Carlo-Simulation über mögliche Gegnerhände          | Simulation pro Zug, berücksichtigt bereits gespielte Karten              |

Die „Normal“-Stufe ist der eigentliche Zielzustand — sie ist der Punkt, an dem
sich das Spiel richtig anfühlt. „Leicht“ ist ein bewusst geschwächter Bot für
Einsteiger, „Schwer“ ist optional und teurer.

## 5. Spielablauf aus Sicht des Spielers

### Hauptmenü
Neues Spiel · Regeln nachlesen · Optionen · Statistik ❓

### Spiel einrichten
Anzahl Gegner (2–5), Bot-Stärke, eigener Name, Regelvarianten,
optional ein Seed für reproduzierbare Partien.

### Eine Runde

1. **Geben** — Karten werden sichtbar ausgeteilt, die eigene Hand fächert auf,
   automatisch sortiert nach Farbe und Wert ❓
2. **Trumpf** — die Trumpfkarte wird aufgedeckt. Bei Magier wählt der Geber
   die Farbe (ist der Spieler selbst der Geber, bekommt er einen Farbdialog).
   Bei Narr oder letzter Runde erscheint deutlich „Kein Trumpf“.
3. **Ansagen** — reihum. Die Bots sagen mit kurzer Verzögerung an, damit man
   mitlesen kann. Der Spieler wählt seine Zahl aus 0..n. Sichtbar dabei:
   die bereits gemachten Ansagen und die laufende Summe im Verhältnis zur
   Stichzahl („5 von 4 Stichen angesagt — es wird eng“).
4. **Stiche** — der Spieler klickt eine Karte. Nicht spielbare Karten sind
   deutlich als gesperrt erkennbar ❓ Nach jedem Stich kurze Pause, der
   Gewinner wird markiert, dann zieht der Stich zu ihm.
5. **Wertung** — Rundenübersicht: pro Spieler Ansage, tatsächliche Stiche,
   Punkte dieser Runde, neuer Gesamtstand.

### Partieende
Endtabelle mit dem Punkteverlauf über alle Runden. Danach: Revanche mit
gleichen Einstellungen, oder zurück ins Menü.

## 6. Was dauerhaft im Bild sein muss

Das ist der wichtigste UI-Beschluss des ganzen Projekts. Vorschlag:

- **Trumpffarbe** — groß, unmissverständlich, immer sichtbar
- **Pro Gegner:** Name, Ansage, aktuelle Stiche, Gesamtpunkte, Anzahl Handkarten
- **Für den Spieler selbst:** dasselbe, plus die Differenz „noch X Stiche nötig“
- **Runde X von Y** und **Stich X von Y**
- **Aktuell angespielte Farbe**
- **Wer ist gerade dran** — eindeutig markiert
- ❓ optional: welche Karten in dieser Runde bereits gespielt wurden
  (Kartenzähl-Hilfe — macht das Spiel leichter, nimmt aber auch Anspannung)

## 7. Grundstimmung — entschieden

**Comichaft und verspielt.** Runecall soll bewusst kein düsteres
Fantasy-Spiel; die Karten sollen freundlich und leicht überzeichnet wirken.

Zwei Dinge, die daraus folgen:

**Es braucht Bildmaterial.** Magier und Narr wollen echte Illustrationen —
typografisch allein entsteht kein Comicstil. Woher die Bilder kommen, ist noch
entschieden (Frage 2.14, KI-generiert). Illustrationen bestehender Spiele sind
urheberrechtlich geschützt und
scheiden aus; „nah am Original“ kann sich nur auf den Stil beziehen.

**Der Stil darf die Lesbarkeit nicht kosten.** Bei sechs Spielern auf einem
Telefonbildschirm zählt, dass man Farbe und Wert einer Karte im Vorbeischauen
erfasst. Der Comicstil lebt deshalb vor allem in Rahmen, Rückseite, Magier,
Narr und den Spielerfiguren — die Zahlenkarten bleiben innen klar und ruhig.

Unabhängig davon sollten die vier Farben nicht allein über Farbe unterscheidbar
sein — Symbol oder Form dazu, sonst ist das Spiel für rot-grün-blinde Spieler
unspielbar. ❓ (Frage 24)

## 8. Bewusst nicht in Version 1

Zur Klarheit, was das Projekt **nicht** ist:

- keine weitergehenden Sonderkarten (Hexe, Vampir, Drache, Fee, Jongleur,
  Werwolf, Wolke, Bombe, Gestaltenwandler)
- kein Hotseat-Modus mit mehreren Menschen an einem Gerät
- kein Fortschrittssystem, keine Freischaltungen
- keine Monetarisierung

Die Sonderkarten sind allerdings der wahrscheinlichste spätere Ausbau. Deshalb
sollte die Stichauswertung von Anfang an so gebaut sein, dass eine Karte ihre
eigene Auswertungslogik mitbringen kann — nicht als harte if-Kette über
„Magier oder Narr oder Zahl“. ❓

## 9. Technische Rahmenbedingungen

Ausführlich in [04-TECHNIK-EMPFEHLUNG.md](04-TECHNIK-EMPFEHLUNG.md). In Kürze:

- TypeScript, strict — dieselbe Grundlage wie Wavebreaker und Chromatic
- Vite; Entwicklung über localhost im Browser
- Aufteilung in vier Pakete: `engine` (Regeln), `bots`, `client` (Oberfläche),
  `server` (Online-Partien)
- Die Regel-Engine kennt weder DOM noch Netzwerk und läuft an drei Stellen:
  in den Tests, im Server und im Client
- Der Server ist autoritativ und schickt jedem Client nur dessen eigene Hand —
  bei einem Spiel mit verdeckten Karten die Grundvoraussetzung
- Seed-basierter Zufall, damit Partien exakt reproduzierbar sind
- Ausgeliefert als Windows-Anwendung (Tauri) und auf dem Handy zunächst als
  installierbare PWA
