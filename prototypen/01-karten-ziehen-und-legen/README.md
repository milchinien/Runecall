# 01 — Karten geben, analysieren, legen

**Frage:** Fühlt sich der Kartenfluss richtig an? Also: Karten kommen vom
Stapel auf die Hand, man erkennt auf einen Blick, was man da hat und was man
davon spielen darf, und das Legen einer Karte auf den Tisch ist ein befriedigender
Vorgang — auf dem PC *und* auf dem Handy.

**Start:** [index.html](index.html) doppelklicken. Sonst nichts. Kein `npm install`,
kein Server, kein Build — eine einzige Datei, die auch über `file://` läuft.

**Ergebnis:** *(noch offen — das musst du fühlen, nicht messen)*

---

## Was drin ist

| Schritt | Was du testen kannst |
|---------|----------------------|
| **Geben** | Karten fliegen einzeln vom Reststapel in die Hand, versetzt gestaffelt. Trumpfkarte wird aufgedeckt. |
| **Analysieren** | Rechte Spalte: Farbverteilung, Trumpfanzahl, Stichschätzung mit Ansagevorschlag, und im laufenden Stich: was ist gesperrt, wer führt, womit könntest du übernehmen. |
| **Legen** | Karte anklicken. Sie fliegt von ihrem Platz im Fächer auf den Tisch. Gesperrte Karten sind ausgegraut und nicht klickbar. |

Dazu die Knöpfe oben rechts:

- **Spieler / Runde / Seed** — jede Kombination von 3–6 Spielern und jeder
  Rundengröße bis zum Maximum. Gleicher Seed heißt gleiche Verteilung, das
  Nachstellen einer Situation ist also jederzeit möglich.
- **Stapeln / Fächern** — schaltet zwischen dem aufgefächerten und dem
  gestapelten Zustand um. Genau die Bewegung aus dem Card-Stack-Vorbild.
- **+1 ziehen** — zieht eine einzelne Karte nach. Regelwidrig, gibt es im Spiel
  nicht; hier nur, um die Zieh-Bewegung isoliert und wiederholt zu sehen.
- **Analyse** — blendet die Seitenspalte aus. So sieht die Handybreite aus.

Die Mitspieler sind stumpfe Automaten: höchste Karte, wenn sie noch Stiche
brauchen, sonst die niedrigste. Sie sind Kulisse, kein Bot-Entwurf.

## Was bewusst fehlt

Punktestand über mehrere Runden, echte Bots, Illustrationen, Ton, Netzwerk,
Barrierefreiheit, Tastaturbedienung. Alles das gehört ins echte Spiel, nicht
hierher.

## Was schon geprüft ist

Die Regeln stimmen — das ist die Grundlage, ohne die das Gefühl nichts aussagt:

- Alle sechs Beispiele aus [01-REGELWERK.md](../../docs/01-REGELWERK.md) §8
  liefern den dort genannten Sieger, dazu der Sonderfall „Narr, dann Magier“
  aus §6.1.
- 24 komplette Runden über 3–6 Spieler durchgespielt, ohne Verstoß gegen die
  Invarianten aus §9: 60 eindeutige Karten, richtige Handgröße, Stichsumme
  gleich Rundenzahl, Ansagen in `0..n`, Bedienpflicht nie verletzt, Wertung
  deterministisch.
- Trumpf-Sonderfälle: Magier aufgedeckt mit dir als Geber (du wählst), Magier
  mit einem Automaten als Geber (er wählt), Narr aufgedeckt (kein Trumpf),
  letzte Runde mit leerem Reststapel (kein Trumpf).
- Gleicher Seed liefert zweimal exakt dieselbe Verteilung.
- Der Fächer passt bei 320 bis 880 Pixeln Breite immer ins Feld, auch bei
  20 Karten.

## Was dabei schon herauskam

**Zwei Fehler, die im echten Spiel genauso aufgetreten wären:**

1. Nach dem letzten Zug eines Stichs ist der Spieler am Zug schon wieder der
   nächste — in der Sekunde bis zur Auswertung ließ sich eine fünfte Karte in
   einen Vierer-Stich legen. Die Engine braucht also einen Zustand
   *„Stich vollständig, Auswertung läuft“*, in dem keine Züge angenommen werden.
2. `requestAnimationFrame` feuert nicht, solange die Seite versteckt ist. Wird
   in genau diesem Moment gegeben — Tab gewechselt, Handybildschirm aus —, bleiben
   die Karten unsichtbar auf dem Stapel liegen und tauchen nie auf. Jede
   Animation, die einen Zustand herstellt, braucht einen Timer als Notbremse.
   Für ein Spiel, das auf dem Handy laufen soll, ist das kein Randfall.

**Eine offene Frage fürs Handy:** Bei 3 Spielern und Runde 20 bleiben auf einem
360-Pixel-Schirm nur rund 11 Pixel je Karte sichtbar. Das reicht nicht, um eine
Karte zu erkennen. Die letzten Runden brauchen dort etwas anderes — zwei Reihen,
seitliches Wischen, oder eine Liste statt eines Fächers. Das ist ein Kandidat
für den nächsten Prototyp.

## Woher die Optik kommt

Die Fächer-Geometrie folgt dem Card-Stack-Baustein von
[kokonutui.com](https://kokonutui.com) (MIT): fester Kartenversatz, mitwachsender
Drehwinkel, gestaffelte Verzögerung beim Auffächern. Übernommen ist die Idee,
nicht der Code — statt React, Next.js und `motion/react` genügen hier CSS-Transforms
mit einer federnden `cubic-bezier`-Kurve. Damit bleibt der Prototyp eine Datei
ohne Installation, und die Bewegung lässt sich einzeln beurteilen, bevor eine
Entscheidung über ein UI-Framework fällt (Frage 2.10).
