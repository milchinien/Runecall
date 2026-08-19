# Runecall — Regelwerk (implementierungsgenau)

Grundlage: das klassische, gemeinfreie Stichansage-Prinzip (*Oh Hell*, auch
*Blackout* oder *Stiche raten*), gespielt mit einem 60-Karten-Deck aus 52
Zahlenkarten, 4 Magiern und 4 Narren.

Weitergehende Sonderkarten (etwa Hexe, Vampir, Drache, Fee, Jongleur, Werwolf,
Wolke, Bombe oder Gestaltenwandler), wie sie andere Spiele dieser Familie
kennen, sind **nicht** Teil dieses Dokuments.

Dieses Dokument ist die normative Referenz für die Implementierung. Wo eine
Regel je nach Ausgabe oder Hausregel abweicht, ist sie mit **[VARIANTE]**
markiert und in [03-OFFENE-FRAGEN.md](03-OFFENE-FRAGEN.md) zur Entscheidung
gestellt.

---

## 1. Kartendeck

| Typ          | Anzahl | Beschreibung          |
|--------------|--------|-----------------------|
| Zahlenkarten | 52     | 4 Farben × Werte 1–13 |
| Magier (M)   | 4      | stärkste Karte        |
| Narr (N)     | 4      | schwächste Karte      |
| **Gesamt**   | **60** |                       |

Farben: Rot, Gelb, Grün, Blau. Die Farben sind gleichwertig; keine Farbe hat
eine feste Rangordnung gegenüber einer anderen. Trumpf wird pro Runde neu
bestimmt.

### Karten-Identität

Jede der 60 Karten ist eindeutig identifizierbar. Die 4 Magier bzw. 4 Narren
sind regeltechnisch untereinander gleichwertig, brauchen aber trotzdem eine
eigene ID — für Animationen, Log, Kartenzählung und Reproduzierbarkeit von
Partien über einen Seed.

---

## 2. Spielerzahl und Rundenanzahl

3–6 Spieler. Die Rundenzahl ergibt sich aus `floor(60 / Spielerzahl)`:

| Spieler | Runden | Karten in letzter Runde | Reststapel letzte Runde |
|---------|--------|-------------------------|-------------------------|
| 3       | 20     | 20                      | 0                       |
| 4       | 15     | 15                      | 0                       |
| 5       | 12     | 12                      | 0                       |
| 6       | 10     | 10                      | 0                       |

In Runde *n* erhält jeder Spieler *n* Karten. In der letzten Runde ist das Deck
exakt aufgebraucht — deshalb gibt es dort **keine** aufgedeckte Trumpfkarte
(siehe 4.4).

---

## 3. Rundenablauf

Jede Runde besteht aus diesen Phasen:

1. **Geben** — Kartenanzahl = Rundennummer, reihum an alle Spieler.
2. **Trumpf bestimmen** — oberste Karte des Reststapels aufdecken (siehe 4).
3. **Ansagen** — jeder Spieler nennt exakt die Zahl der Stiche, die er
   gewinnen wird (siehe 5).
4. **Stiche spielen** — *n* Stiche werden ausgespielt (siehe 6).
5. **Werten** — Punkte gemäß Abschnitt 7 vergeben, Gesamtstand fortschreiben.

### 3.1 Geber und Sitzreihenfolge

- Der Geber rotiert nach jeder Runde um einen Platz im Uhrzeigersinn.
- Der Spieler **links vom Geber** sagt zuerst an und eröffnet den ersten Stich.
- Der Geber sagt als **letzter** an — das ist ein bewusster Vorteil, weil er
  alle anderen Ansagen kennt.

### 3.2 Startspieler innerhalb der Runde

- Stich 1 wird vom Spieler links des Gebers eröffnet.
- Jeder weitere Stich wird vom **Gewinner des vorherigen Stichs** eröffnet.

---

## 4. Trumpfbestimmung

Nach dem Geben wird die oberste Karte des Reststapels aufgedeckt.

### 4.1 Zahlenkarte aufgedeckt
Deren Farbe ist Trumpf für diese Runde.

### 4.2 Magier aufgedeckt
Der **Geber wählt** die Trumpffarbe — und zwar erst, nachdem er seine eigenen
Handkarten gesehen hat, aber **bevor** die erste Ansage erfolgt.

### 4.3 Narr aufgedeckt
In dieser Runde gibt es **keinen Trumpf**. Es gewinnt nur die angespielte Farbe
bzw. ein Magier.

### 4.4 Letzte Runde
Es bleibt keine Karte übrig → **kein Trumpf**. Verhält sich wie 4.3.

### 4.5 Status der aufgedeckten Karte
Die aufgedeckte Trumpfkarte bleibt bis Rundenende offen liegen und nimmt **nicht**
am Spiel teil. Sie ist damit auch für die Kartenzählung eine bekannte,
aus dem Spiel genommene Karte.

---

## 5. Ansagen (Bidding)

- Erlaubter Wertebereich: `0 .. Rundennummer` (also 0..n bei n Karten).
- Reihenfolge: beginnend links vom Geber, im Uhrzeigersinn; Geber zuletzt.
- Die Ansagen sind **öffentlich** und bleiben die ganze Runde sichtbar.
- Die Summe der Ansagen muss **nicht** der Stichzahl entsprechen. Sie darf
  darüber oder darunter liegen. Genau daraus entsteht der Spielreiz.
- Eine einmal gemachte Ansage ist bindend und kann nicht geändert werden.

**[VARIANTE] Geber-Einschränkung (verbreitete Hausregel):** Der Geber darf als
letzter Ansager keine Zahl nennen, die die Gesamtsumme exakt auf die Stichzahl
bringt. Damit ist garantiert, dass mindestens ein Spieler danebenliegt. Im
klassischen Grundspiel gilt diese Einschränkung **nicht** — so ist es auch für
Runecall entschieden.

**[VARIANTE] Verdeckte Ansage:** Alle sagen gleichzeitig verdeckt an, dann
Aufdecken. Nimmt dem Geber seinen Positionsvorteil.

---

## 6. Stichspiel

### 6.1 Angespielte Farbe

Die angespielte Farbe wird durch die **erste Zahlenkarte** im Stich bestimmt.
Daraus folgen drei Fälle für die eröffnende Karte:

| Eröffnungskarte | Angespielte Farbe                                               |
|-----------------|-----------------------------------------------------------------|
| Zahlenkarte     | deren Farbe                                                     |
| Magier          | **keine** — alle nachfolgenden Spieler sind frei                |
| Narr            | noch **offen** — die nächste Zahlenkarte im Stich legt sie fest |

Beim Narr-Anspiel gilt weiter: Wird nach dem Narr ein **Magier** gespielt,
bevor eine Zahlenkarte fällt, ist für den Rest des Stichs **keine** Farbe
angespielt — alle Folgenden sind frei. Liegen nur Narren, wird nie eine Farbe
angespielt.

### 6.2 Bedienpflicht

- Ist eine Farbe angespielt und der Spieler besitzt mindestens eine Karte
  dieser Farbe, **muss** er eine Karte dieser Farbe spielen.
- **Ausnahme:** Magier und Narr dürfen **immer** gespielt werden, unabhängig
  von der Bedienpflicht.
- Kann ein Spieler nicht bedienen, ist er **frei**: beliebige Farbe abwerfen,
  Trumpf spielen, Magier oder Narr spielen. Es gibt **keine** Trumpfpflicht.
- Ist keine Farbe angespielt (Magier eröffnet, oder bisher nur Narren), darf
  jeder alles spielen.

### 6.3 Stichgewinner

Ausgewertet in dieser Reihenfolge — die erste zutreffende Regel entscheidet:

1. Liegt mindestens ein **Magier** im Stich → der **zuerst gespielte** Magier gewinnt.
2. Liegt mindestens eine **Trumpfkarte** im Stich → die **höchste** Trumpfkarte gewinnt.
3. Sonst → die **höchste Karte der angespielten Farbe** gewinnt.
4. Liegen ausschließlich **Narren** → der **zuerst gespielte** Narr gewinnt.

Narren gewinnen nie gegen eine Zahlenkarte oder einen Magier. Ein Trumpf
schlägt jede Zahlenkarte einer anderen Farbe, unabhängig vom Zahlenwert.
Gibt es keinen Trumpf (4.3 / 4.4), entfällt Schritt 2.

**Sonderfall:** Ein Stich, in dem nur Narren liegen, hat trotzdem einen
Gewinner — der zählt für dessen Ansage als gewonnener Stich, und er eröffnet
den nächsten Stich.

### 6.4 Nach dem Stich

Der Gewinner nimmt den Stich, sein Stichzähler steigt um 1, und er eröffnet den
nächsten Stich. Nach *n* Stichen ist die Runde beendet.

---

## 7. Wertung

Am Rundenende wird für jeden Spieler verglichen: **Ansage** gegen
**tatsächlich gewonnene Stiche**.

### Ansage exakt getroffen

```
Punkte = 20 + 10 × Ansage
```

| Ansage | Punkte |
|--------|--------|
| 0      | +20    |
| 1      | +30    |
| 2      | +40    |
| 3      | +50    |
| 4      | +60    |
| 5      | +70    |

### Ansage verfehlt

```
Punkte = −10 × |Ansage − tatsächliche Stiche|
```

Zu viele und zu wenige Stiche sind gleich schlecht.

| Ansage | Stiche | Abweichung | Punkte |
|--------|--------|------------|--------|
| 2      | 1      | 1          | −10    |
| 2      | 0      | 2          | −20    |
| 2      | 4      | 2          | −20    |
| 4      | 1      | 3          | −30    |

### Spielende

Nach der letzten Runde gewinnt der Spieler mit der **höchsten Gesamtpunktzahl**.
Gesamtpunkte können negativ werden.

**[VARIANTE] Gleichstand:** Klassisch nicht geregelt. Optionen: geteilter Sieg,
oder Entscheidung über die Anzahl exakt getroffener Ansagen.

---

## 8. Vollständige Beispiele (als Testfälle verwendbar)

### 8.1 Trumpf schlägt hohe Farbkarte
Trumpf = Rot. Anna eröffnet.

| Spieler | Karte   |
|---------|---------|
| Anna    | Grün 10 |
| Ben     | Grün 12 |
| Chris   | Rot 4   |
| David   | Grün 13 |

→ **Chris** gewinnt (einziger Trumpf).

### 8.2 Fremde Farbe verliert trotz hoher Zahl
Trumpf = Rot. Anna eröffnet Grün.

| Spieler | Karte   |
|---------|---------|
| Anna    | Grün 8  |
| Ben     | Grün 12 |
| Chris   | Blau 13 |
| David   | Grün 10 |

→ **Ben** gewinnt. Blau 13 ist weder Trumpf noch angespielte Farbe.

### 8.3 Erster Magier gewinnt

| Spieler | Karte    |
|---------|----------|
| A       | Magier |
| B       | Magier |
| C       | Rot 13   |
| D       | Magier |

→ **A** gewinnt.

### 8.4 Narr-Anspiel legt Farbe nicht fest
Trumpf = Blau.

| Spieler | Karte   | Wirkung                      |
|---------|---------|------------------------------|
| A       | Narr    | keine Farbe angespielt       |
| B       | Grün 5  | ab jetzt ist Grün angespielt |
| C       | Grün 9  | musste bedienen              |
| D       | Blau 2  | hatte kein Grün → Trumpf     |

→ **D** gewinnt.

### 8.5 Nur Narren

| Spieler | Karte |
|---------|-------|
| A       | Narr  |
| B       | Narr  |
| C       | Narr  |

→ **A** gewinnt (zuerst gespielt) und eröffnet den nächsten Stich.

### 8.6 Komplette Mini-Runde (3 Spieler, Runde 1)
Trumpf = Grün. Anna: Rot 10, Ben: Magier, Chris: Blau 7.
Ansagen: Anna 0, Ben 1, Chris 0.
Anna eröffnet mit Rot 10, Ben spielt Magier, Chris spielt Blau 7.

→ Ben gewinnt. Wertung: Anna +20, Ben +30, Chris +20.

---

## 9. Regel-Invarianten (für Assertions im Code)

Diese Bedingungen müssen zu jedem Zeitpunkt gelten und eignen sich für
Laufzeit-Assertions und Property-Tests:

1. Über alle Hände + gespielte Karten + Reststapel + Trumpfkarte hinweg
   existiert jede der 60 Karten **genau einmal**.
2. In Runde *n* hat jeder Spieler zu Rundenbeginn genau *n* Karten.
3. Die Summe der gewonnenen Stiche aller Spieler ist am Rundenende genau *n*.
4. Jede Ansage liegt in `0..n`.
5. Jeder gespielte Zug ist gemäß 6.2 legal.
6. Ein Spieler kann nie mehr Stiche gewinnen, als er Karten auf der Hand hatte.
7. Die Punktänderung einer Runde ist deterministisch aus (Ansagen, Stiche)
   berechenbar — keine versteckte Zufallskomponente.
8. Bei gleichem Seed und gleicher Zugfolge ist die Partie exakt reproduzierbar.
