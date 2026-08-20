# Kartengrafik — Prompts für das Standardset

61 Bilder: 52 Zahlenkarten, 4 Magier, 4 Narren, 1 Rückseite.
Erzeugt mit ChatGPT, ausgewählt und freigegeben von dir (Entscheidung 2.14).

---

## 1. Was generiert wird — und was nicht

**Generiert wird ausschließlich das Bildmotiv.** Rahmen, Zahlen, Runen und
Farbleiste zeichnet der Client.

Der Grund ist praktisch, nicht ästhetisch: Bildgeneratoren setzen Ziffern
unzuverlässig. Über 52 Zahlenkarten hinweg bekommst du verdrehte, doppelte oder
schlicht falsche Zahlen — und die Zahl ist auf einem Telefon die wichtigste
Information der Karte. Im Code gezeichnet ist sie in jeder Größe gestochen
scharf, exakt richtig und jederzeit änderbar.

```
┌─────────────────┐
│ 12  ᛚ    ᛚ  12  │  ← Code: Zahl, Rune, Farbleiste
│                 │
│   ╭─────────╮   │
│   │         │   │
│   │  BILD   │   │  ← ChatGPT: nur dieser Bereich
│   │         │   │
│   ╰─────────╯   │
│                 │
│ ZL  ᛚ    ᛚ  ZL  │  ← Code: dieselbe Zeile, um 180° gedreht
└─────────────────┘
```

**Der zweite Vorteil betrifft deine Kartensets.** Wenn der Rahmen im Code
liegt, ist ein neues Set nur ein Austausch von 61 Bilddateien — gleiche Namen,
gleiche Maße. Kein Set muss je wieder mit Zahlen versehen werden.

### Dateinamen

Genau die Karten-IDs aus [packages/engine/src/cards.ts](../packages/engine/src/cards.ts):

```
red-1.png   …  red-13.png
yellow-1.png …  yellow-13.png
green-1.png  …  green-13.png
blue-1.png   …  blue-13.png
mage-1.png   …  mage-4.png
jester-1.png …  jester-4.png
back.png
```

Ablage später: `packages/client/public/cards/<set-name>/<id>.png`.
Das Standardset heißt `standard`.

### Technische Vorgaben für jedes Bild

| | |
|---|---|
| Format | PNG, quadratisch, 1024 × 1024 |
| Hintergrund | **deckend** in der Farbe der jeweiligen Kartenfarbe (Hex unten). Keine Transparenz — Bildgeneratoren liefern die nicht zuverlässig. |
| Schutzrand | Das Motiv bleibt innerhalb der mittleren 76 %. Der Rahmen beschneidet auf 4:5, außen darf nichts Wichtiges liegen. |
| Text im Bild | **keiner.** Keine Zahlen, keine Namen, keine Runen, keine Signatur. |

---

## 2. Der Stilblock

Einmal am Anfang einer ChatGPT-Unterhaltung einfügen, danach je Karte nur noch
die Motivzeile. Das hält den Stil über eine ganze Farbe hinweg zusammen —
besser, als den Block 13-mal zu wiederholen.

Der Block ist auf Englisch, weil Bildmodelle darauf spürbar genauer reagieren.

```text
You are generating illustrations for a minimalist trick-taking card game
called Runecall. I will send you one subject line at a time. For each one,
produce a single square 1024x1024 image following ALL of these rules exactly.

STYLE
- Flat vector illustration. Bold, simple shapes. No painterly rendering,
  no photorealism, no 3D, no texture, no noise, no gradients except one
  single soft radial glow where explicitly requested.
- Every subject is reduced to its most iconic silhouette. Think woodcut or
  screen print, not fantasy book cover. Fewer shapes is always better.
- One consistent dark outline on every shape: colour #241F18, even weight,
  rounded joins, roughly 8px at 1024x1024. No sketchy or varying linework.
- Maximum four fill colours per image, taken only from the palette below.
- Flat lighting. No cast shadows. At most one simple darker shape used as
  a ground shadow directly under the subject.

COMPOSITION
- Single subject, centred, facing the viewer or in clean profile.
- Solid flat background in the suit colour given with the subject.
- No scenery, no landscape, no horizon line, no clouds, no framing devices,
  no borders, no vignette. The background is one flat colour, nothing else.
- The subject fills roughly 60% of the frame and stays entirely within the
  central 76% of the canvas. Generous empty margin on all sides.
- Slight, calm, friendly character. Playful but not cartoonish-goofy.

ABSOLUTELY NOT
- No text, no numbers, no letters, no runes, no symbols, no signatures,
  no watermarks anywhere in the image.
- No card frame, no card border, no rounded card corners. The image is the
  artwork only, edge to edge.
- No human faces in close-up detail; faces stay simple, two dots and a line
  at most.

Confirm you understand, then wait for my first subject line.
```

### Farbpalette

Dieselben Werte wie in [packages/client/src/style.css](../packages/client/src/style.css),
damit Bild und Oberfläche zusammenpassen.

| Farbe | Hintergrund | Motivfarbe | Akzent | Kontur |
|-------|-------------|------------|--------|--------|
| Rot | `#F2D9D4` | `#D84A3C` | `#8E2C22` | `#241F18` |
| Gelb | `#F5E8C8` | `#D9A11C` | `#8A5F0C` | `#241F18` |
| Grün | `#D9EADD` | `#369A58` | `#1E5E36` | `#241F18` |
| Blau | `#D8E3F3` | `#3A72C6` | `#22467F` | `#241F18` |
| Magier | `#E4DBF7` | `#6D3FD1` | `#3E2280` | `#241F18` |
| Narr | `#EDE7DC` | `#7D7263` | `#4A4239` | `#241F18` |

---

## 3. Der Aufbau der vier Farben

Jede Farbe folgt ihrer Rune und steigert sich von 1 nach 13 — vom Kleinsten
zum Mächtigsten. Der gleiche Rang bedeutet in jeder Farbe etwas Ähnliches,
damit man beim Spielen ein Gefühl dafür entwickelt, was eine hohe Karte ist.

| Rang | Bedeutungsstufe |
|------|-----------------|
| 1–4 | das Kleinste: Keim, Funke, Tropfen |
| 5–8 | Werkzeug und Ort |
| 9–12 | Lebewesen, aufsteigend nach Macht |
| 13 | die Farbe selbst in ihrer größten Form |

---

## 4. Rot — Kenaz, die Fackel

Feuer, Glut, Schmiede. Hintergrund `#F2D9D4`, Motiv `#D84A3C`, Akzent `#8E2C22`.

```text
All red-suit subjects: flat background #F2D9D4, main shapes #D84A3C,
darker accents #8E2C22, outline #241F18.

1  — A single spark, one small four-pointed star shape, alone, with three tiny
     motion ticks beneath it.
2  — A small loose bundle of tinder twigs, tied once in the middle.
3  — One lump of glowing coal, rounded, with a soft radial glow around it.
4  — A single upright candle with one calm teardrop flame.
5  — A torch: short handle, wide wrapped head, three simple flame tongues.
6  — A flint stone and a curved steel striker crossing, one spark between them.
7  — A campfire: three crossed logs, one broad flame above them.
8  — A blacksmith hammer resting on a squat anvil, seen from the side.
9  — A forge furnace: a squat stone arch with fire visible inside the opening.
10 — A standing brazier on three legs, wide bowl, tall flame.
11 — A salamander in clean profile, long body, short legs, curled tail, small
     flame shapes running along its back.
12 — A phoenix seen head-on, wings spread wide and symmetrical, tail feathers
     rising like flames.
13 — A volcano: one broad triangular cone with a wide plume erupting from the
     top, three simple lava streaks on its flanks.
```

---

## 5. Gelb — Sowilo, die Sonne

Licht, Wärme, Tag. Hintergrund `#F5E8C8`, Motiv `#D9A11C`, Akzent `#8A5F0C`.

```text
All yellow-suit subjects: flat background #F5E8C8, main shapes #D9A11C,
darker accents #8A5F0C, outline #241F18.

1  — Three tiny grains of sand falling in a loose diagonal line.
2  — A single bent stalk of straw.
3  — One ear of wheat, upright, symmetrical, with a short stem.
4  — A sunflower seen head-on, round centre, twelve simple petals.
5  — A hanging lantern with a glass body and one small flame inside.
6  — An hourglass in a simple wooden frame, sand falling in a thin stream.
7  — A sundial: a round flat disc seen at a slight angle with one triangular
     gnomon casting a single straight shadow.
8  — A desert dune: two overlapping smooth curved shapes forming a crest.
9  — A piece of amber, an irregular polished stone with one tiny insect
     silhouette suspended inside.
10 — An eagle in clean side profile, head turned, wings folded, standing.
11 — A lion's head seen head-on, mane as a ring of simple pointed shapes.
12 — A sun disc: a solid circle with eight straight rays and a simple spiral
     carved in its centre.
13 — The sun itself rising: a large half-circle at the lower edge of the
     subject area with long straight rays spreading upward and outward.
```

---

## 6. Grün — Berkano, die Birke

Wald, Wachstum, Tier. Hintergrund `#D9EADD`, Motiv `#369A58`, Akzent `#1E5E36`.

```text
All green-suit subjects: flat background #D9EADD, main shapes #369A58,
darker accents #1E5E36, outline #241F18.

1  — A single seed, one small teardrop shape, resting alone.
2  — A sprout: two tiny round leaves on a short curved stem.
3  — One broad leaf with a single central vein and three side veins.
4  — A fern frond curling at the tip, arched.
5  — A single mushroom with a wide domed cap and a short thick stem.
6  — A short branch bearing five round berries and two leaves.
7  — A birch trunk section, upright, with three simple dark bark marks.
8  — A pair of antlers alone, symmetrical, four points each side.
9  — A wolf standing in clean side profile, head lowered, tail low.
10 — A bear seen head-on, sitting, round ears, simple snout.
11 — An owl seen head-on, perched, two large round eyes, folded wings.
12 — A great stag standing in side profile with a tall symmetrical crown of
     antlers, head raised.
13 — A world tree: one broad trunk, a wide round canopy, and a symmetrical
     root system spreading below.
```

---

## 7. Blau — Laguz, das Wasser

Wasser, Nebel, Tiefe. Hintergrund `#D8E3F3`, Motiv `#3A72C6`, Akzent `#22467F`.

```text
All blue-suit subjects: flat background #D8E3F3, main shapes #3A72C6,
darker accents #22467F, outline #241F18.

1  — A single falling water drop with one small ripple ring beneath it.
2  — Three smooth stacked river pebbles, largest at the bottom.
3  — One small curling wave, crest turning over, three foam dots.
4  — A spiral seashell seen from the side.
5  — A cluster of five reeds rising from a short waterline.
6  — Mist: three horizontal soft-edged bands of overlapping shapes, nothing else.
7  — Rain: five straight diagonal strokes with three ripple rings below them.
8  — A river bend seen from above, one wide curving band narrowing at both ends.
9  — A salmon in clean side profile, leaping, body arched upward.
10 — An ice floe: three flat angular slabs floating, one tilted up.
11 — A sea serpent coiled into two smooth loops, head raised at one end.
12 — A whale seen in side profile, broad body, tail raised, one spout above.
13 — A maelstrom seen from above: concentric spiralling bands drawing inward
     to a dark centre.
```

---

## 8. Die vier Magier

Bewusst **nicht** in einer der vier Farben, sondern durchgehend violett — ein
Magier darf nie mit einer Farbkarte verwechselt werden. Die vier unterscheiden
sich nur in der Geste, nie in der Stärke.

Hintergrund `#E4DBF7`, Motiv `#6D3FD1`, Akzent `#3E2280`.

```text
All mage subjects: flat background #E4DBF7, main shapes #6D3FD1, darker
accents #3E2280, outline #241F18. Same character design in all four: a tall
slender figure in a long hooded robe, face simplified to two dots, a wide
pointed hood, no visible hands beyond simple mitten shapes. Only the pose
changes.

mage-1 — The mage standing frontally, one hand raised high, a single small
         glowing orb hovering just above the open palm.
mage-2 — The mage in side profile, holding a tall straight staff upright with
         both hands, staff head crowned by one small orb.
mage-3 — The mage frontally, both arms spread wide and low, robe flaring
         outward, three small orbs orbiting at chest height.
mage-4 — The mage in three-quarter view, head bowed over an open book held in
         both hands, three small orbs rising from its pages.
```

---

## 9. Die vier Narren

Gedeckt und warm, damit sie sich vom Magier und von jeder Farbe absetzen.
Der Narr ist die schwächste Karte — er soll harmlos wirken, nicht traurig.

Hintergrund `#EDE7DC`, Motiv `#7D7263`, Akzent `#4A4239`.

```text
All jester subjects: flat background #EDE7DC, main shapes #7D7263, darker
accents #4A4239, outline #241F18. Same character design in all four: a short
round figure in a simple tunic wearing a two-pointed cap with a small bell on
each point, face simplified to two dots and a small curved smile. Only the
pose changes.

jester-1 — The jester mid-stumble, one foot forward, both arms flung upward,
           cap tips flying sideways.
jester-2 — The jester juggling three balls, two in the air, one already
           falling past his hip, eyes following the falling one.
jester-3 — The jester asleep, sitting cross-legged, head tipped forward,
           cap drooping over the face.
jester-4 — The jester standing, whistling, hands behind his back, looking
           deliberately away to one side.
```

---

## 10. Die Rückseite

Eine einzige Rückseite für alle 61 Karten. Zwei Anforderungen, die sich aus
dem Spiel ergeben:

**Punktsymmetrisch.** Eine Karte darf nicht verraten, ob sie gedreht liegt.
Die Rückseite muss um 180° gedreht identisch aussehen.

**Kein Durchscheinen.** Dunkler Grund, damit von vorn nichts durchscheint.

Diese Rückseite ist die Ausnahme von der Textregel: hier dürfen die vier Runen
vorkommen. Sie sind Wappen, nicht Information.

```text
A card back design for a minimalist card game, square 1024x1024, flat vector
illustration in the same style as before.

- Deep dark background #1A1712, filling the entire canvas edge to edge.
- One centred diamond-shaped emblem made of four simple rune marks arranged
  around a central point, one in each direction: a angular chevron pointing
  left, a zigzag, a vertical stroke with two triangles, and a vertical stroke
  with one diagonal. Each mark is a plain straight-line glyph, even stroke
  weight, rounded caps.
- The four marks are coloured #D84A3C, #D9A11C, #369A58 and #3A72C6, one each,
  arranged so the design is IDENTICAL when rotated 180 degrees.
- A thin single-stroke border line in #6D3FD1 inset from the edge, forming a
  simple rectangle. Nothing else.
- Perfectly point-symmetric. No text, no letters, no numbers, no signature.
- Flat colours only, no gradients, no texture, no glow, no shadow.
```

---

## 11. So gehst du am besten vor

**Farbe für Farbe, in je einer Unterhaltung.** Stilblock einfügen, dann die 13
Motivzeilen nacheinander. Der Generator hält den Stil innerhalb einer
Unterhaltung deutlich besser als über mehrere hinweg.

**Erst eine Probekarte je Farbe.** Nimm die 13 zuerst — sie ist die
aufwendigste. Wenn die sitzt, stimmt der Stil auch für die anderen zwölf.

**Nachbessern statt neu würfeln.** Wenn ein Bild fast passt, beschreibe die
Abweichung („die Kontur ist zu dünn", „der Hintergrund hat einen Verlauf")
statt es blind neu zu erzeugen.

**Die Prüfung am Ende:** Lege alle 13 Bilder einer Farbe nebeneinander. Wenn
eines herausfällt, ist es meist die Konturstärke oder ein Verlauf im
Hintergrund — beides sind die häufigsten Regelverstöße des Generators.

**Auf Handygröße prüfen.** Ein Motiv, das bei 1024 Pixeln großartig aussieht,
kann bei 50 Pixeln Breite ein grauer Fleck sein. Das ist der eigentliche Test:
Erkennst du die Karte, wenn sie so groß ist wie dein Daumennagel?

---

## 12. Was für spätere Kartensets gleich bleiben muss

Damit ein Spieler Sets wechseln kann, ohne dass etwas bricht, ist jedes Set an
denselben Vertrag gebunden:

| Muss gleich bleiben | Darf sich ändern |
|---------------------|------------------|
| die 61 Dateinamen | jedes Motiv |
| 1024 × 1024, PNG | Stil, Epoche, Thema |
| Schutzrand: Motiv in den mittleren 76 % | die Farbpalette |
| kein Text im Bild | Grad der Abstraktion |
| Rückseite punktsymmetrisch | |

Die Zuordnung Farbe → Rune bleibt ebenfalls fest, weil die Rune im Rahmen
gezeichnet wird und nicht Teil des Sets ist. Ein Set kann also eine völlig
andere Bildwelt haben — Weltraum, Unterwasser, Küche — solange die vier
Farbgruppen unterscheidbar bleiben.

Ideen für später: `tusche` (nur Schwarz-Weiß mit einem Farbakzent),
`neon` (dunkel mit leuchtenden Konturen), `kinder` (dicke runde Formen,
sehr wenige Details).
