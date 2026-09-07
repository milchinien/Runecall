# Tischansicht — vom Bildschirmaufbau zum Raum

Ziel: Man sitzt nicht vor einer Seite, sondern **an einem Tisch**. Die
Mitspieler sitzen ringsum, ihre Karten liegen als Rückseiten sichtbar vor
ihnen, in der Mitte wächst ein Ablagestapel, und jede gelegte Karte kommt
sichtbar **aus der Richtung des Spielers**, der sie gespielt hat. Der Raum ist
violett, leuchtend, mit Partikeln hinter den Sitzplätzen. Karten sollen sich
wie Karten anfühlen: Dicke, Gewicht, Schwung.

Erst am PC, danach das Handy (Entscheidung 4.3).

---

## Entschieden: echtes 3D mit WebGL

Tisch, Karten, Licht und Partikel sind Objekte in einer Szene mit Kamera.
Kartenmotive werden Texturen. Das ist der aufwendigste der drei erwogenen
Wege und zugleich der einzige, der Schatten, Wölbung und echtes Werfen
hergibt — Entscheidung 4.1.

**Die Bedienoberfläche bleibt HTML über der Szene** (Entscheidung 4.2). Menü,
Ansageknöpfe, Wertungstafel, Namen und Punktestände sind Text: In eine Textur
gerendert wäre er unscharf, nicht markierbar, nicht vorlesbar und nicht mit
der Tastatur erreichbar. Sie liegen deshalb als gewohnte HTML-Schicht über der
Zeichenfläche. In der Szene liegt, was ein Gegenstand ist — Karten, Tisch,
Stapel, Licht.

### Was dieser Weg zusätzlich verlangt

Vier Punkte, die beim flachen Aufbau nicht anfielen und im Zeitplan stehen
müssen, statt später zu überraschen:

- **Ein Paket mehr.** Eine 3D-Bibliothek wiegt auch sparsam gebaut ein
  Vielfaches des heutigen Clients (heute rund 27 kB). Das ist der Preis und
  bewusst bezahlt.
- **Texturen statt Bilder.** 61 Motive einzeln als Textur bedeutet 61-mal
  Umschalten je Bild. Sie kommen deshalb in eine gemeinsame Bildtafel, aus
  der jede Karte ihren Ausschnitt bezieht.
  `tools/prepare-cards.mjs` erzeugt diese Tafel künftig mit.
- **Anklicken muss berechnet werden.** In der Szene gibt es keine Elemente,
  die von selbst auf Klicks reagieren; der Zeiger wird als Strahl in die
  Szene geschickt und trifft eine Karte. Das ersetzt, was der Browser vorher
  geschenkt hat.
- **Bedienbarkeit ohne Maus muss nachgebaut werden.** Karten in einer
  Zeichenfläche sind für Tastatur und Vorlesehilfen unsichtbar. Es braucht
  eine unsichtbare, aber bedienbare Entsprechung der eigenen Hand in der
  HTML-Schicht.

### Was unangetastet bleibt

**Engine, Bots und Ablaufsteuerung.** Das ist der Ertrag der Trennung aus
[04-TECHNIK-EMPFEHLUNG.md](04-TECHNIK-EMPFEHLUNG.md): Die Regeln wissen nichts
von Darstellung, die Bots bekommen ohnehin nur ihre eigene Sicht, und
`session.ts` kennt nur Züge und Wartezeiten. Ausgetauscht wird ausschließlich
die Darstellungsschicht — heute `ui.ts` plus Stylesheet. Die 58 Tests laufen
über den Umbau hinweg unverändert weiter.

### Rechtliches

Der Aufbau, den wir übernehmen — runder Tisch, Sitzplätze ringsum,
Ablagestapel in der Mitte — ist die übliche Anordnung für Kartenspiele und
niemandes Eigentum. Nicht übernommen werden Erkennungsmerkmale eines
bestimmten Produkts: dessen Farbwelt, Kartenformen, Schriftzüge, Figuren. Der
violette Raum setzt sich davon ohnehin ab. Grundlage bleibt
[06-RECHTLICHES.md](06-RECHTLICHES.md): Der Stil darf sich anlehnen, die
Gestaltung muss eigenständig sein.

---

## Stufe 1 — Der Raum

Nur Kulisse, kein Spiel. Danach sieht es anders aus, funktioniert aber genau
wie vorher: Die heutige Oberfläche liegt über der Szene weiter.

- Szene, Kamera und Ansicht stehen; die Zeichenfläche füllt das Fenster und
  wächst mit.
- Violette Bühne: dunkler Grund, warmes Leuchten zur Mitte, Abdunklung zum
  Rand. Mehrere Violetttöne statt einer Fläche, damit Tiefe entsteht.
- Tischplatte als Ellipse, leicht nach hinten gekippt, mit weichem Licht von
  oben.
- Partikel hinter den Sitzplätzen: langsam aufsteigende Lichtpunkte,
  unterschiedlich groß und hell.

**Fertig, wenn:** Der Raum steht, das Spiel läuft unverändert weiter, die
Bildrate bleibt flüssig, und bei `prefers-reduced-motion` stehen die Partikel
still.

### Nachtrag: was seither dazugekommen ist

Der Raum stand — und sah aus wie ein Farbverlauf mit einer Scheibe darin.
Nachgelegt wurde deshalb, in dieser Reihenfolge:

- **Schwaden und Sterne.** Die Bühne bekam Struktur: viele weiche, in die
  Länge gezogene Flecken, von denen jeder einzelne fast unsichtbar ist, und
  900 Sterne als eigene Punkte in der Szene. Gemalte Sterne gingen nicht —
  die Kugeltextur wird so stark vergrößert, dass ein Bildpunkt am Bildschirm
  ein gutes Dutzend wird.
- **Der Tisch verliert seine Silhouette.** Kein scharfer heller Ring mehr auf
  der Kante, sondern zwei blasse Schichten, die nach außen auslaufen; die
  Zarge wird nach unten durchsichtig; der äußere Filz läuft auf den Ton der
  Bühne zu. Er soll in der Bühne liegen, nicht davor stehen.
- **Filz mit Zeichnung:** Gewebe, ein schwacher Strahlenstern aus der Mitte,
  der Runenkreis mit den vier Farbrunen und außen eine Borte aus zwei Linien
  mit Strichen dazwischen.
- **Der Kartensturm** (`scene/storm.ts`): ein Wirbel kleiner Karten um den
  Tisch, überwiegend Motive. Alle in einer einzigen Geometrie, die Bild für
  Bild neu beschrieben wird. Sie prüfen die Tiefe — was hinter dem Tisch
  vorbeitreibt, verschwindet auch dahinter — und schrumpfen weg, bevor sie
  der Kamera zu nahe kommen. Gezeichnet werden sie aufaddiert statt
  daraufgelegt: Sie sollen keine Aufkleber auf der Bühne sein, sondern darin
  leuchten. Deshalb überwiegen die Motive — was dunkel ist, trägt beim
  Aufaddieren fast nichts bei, und die Rückseiten sind dunkel.

- **Der leuchtende Grund.** Aus dem senkrechten Farbverlauf wurde eine Farbe,
  die das ganze Bild trägt. Eingestellt ist er an gemessenen Bildpunkten der
  Vorlage, in unsere Farbe umgerechnet. Drei Eigenschaften zählen dabei, und
  jede einzelne davon hat mich zwischendurch einen Anlauf gekostet:
  eine **breite** helle Mitte (über das erste Drittel des Verlaufs bleibt es
  fast gleich hell — fällt es gleich ab, sieht es aus wie ein Scheinwerfer),
  ein **kräftiger** Abfall dahinter (zur Ecke auf etwa ein Viertel), und
  **Farbe bis in die Ecke** (in der Vorlage steht dort ein sattes Rot mit
  122/1/8, kein Grau — Grün und Blau sind fast auf null).
- **Hellere und dunklere Stellen statt Formen.** Auf dem Grund lagen erst
  Facetten mit geraden Kanten, dann noch Ringe um die Mitte. Beides sind
  Formen, die man wiedererkennt — und wo man eine Form erkennt, sucht man
  einen Grund dafür: Die Facetten lasen sich als Strahlen, die auf einen
  Sitzplatz zulaufen. Jetzt sind es dreißig weiche Flecken über die ganze
  Fläche, je zur Hälfte heller und dunkler als der Grund. Wo sie liegen, ist
  gleichgültig; entscheidend ist, dass keiner eine Kante hat — jeder läuft
  nach außen auf null aus, sodass zwischen zwei Flecken immer ein Verlauf
  steht und nie ein Rand.
- **Die Blätter der Mitspieler nach der Vorlage.** *(Überholt — siehe
  „Nachtrag: aus dem Stapel wird ein Fächer" weiter unten. Der Text bleibt
  stehen, weil die Begründung der Korrektur sonst in der Luft hinge.)*
  Kein Fächer mehr, sondern
  ein schräg stehender Stapel: alle Karten **parallel**, stark überlappend,
  sichtbar ist je Karte nur ein schmaler Streifen. Die vorderste liegt außen
  zum Bildrand hin, der Stapel läuft von dort zur Tischmitte — andersherum
  verdeckt der Stapel sein eigenes Blatt. Der Versatz läuft entlang der
  Querachse der Karte, also mitgeneigt; sonst stehen die Karten schräg, der
  Stapel aber gerade. Die Richtung der Neigung steht ebenfalls in der Vorlage:
  Links steigt der Stapel nach rechts an, rechts fällt er nach rechts ab —
  beide neigen sich von der Tischmitte weg. Das Vorzeichen war zuerst
  andersherum; es fällt sofort auf, wenn man die beiden Seiten
  nebeneinanderlegt, und gar nicht, wenn man nur eine ansieht. Dazu ein
  **Bogen**: Jede weitere Karte dreht sich ein Stück gegen ihre Vorgängerin
  und setzt ihren Schritt entlang der eigenen, schon mitgedrehten Querachse —
  dadurch läuft der Stapel krumm statt gerade, so wie jemand ein Blatt hält.
  Bei vollem Blatt wird die Drehung gedeckelt: dreizehn Karten mal vollem
  Schritt wären eine Dreiviertelumdrehung, also ein Rad und kein Blatt.
  Neigung und Bogen wachsen mit der Seitenlage des Platzes — wer genau
  gegenüber sitzt, bekommt weder das eine noch das andere: Sein Blatt liegt
  quer zum Blick, und alles Krumme daran sähe von hier aus nach einem Fehler
  aus. In der Vorlage liegen die Karten des Gegenübers ebenfalls in einer
  geraden Reihe.
- **Die fremden Blätter sind ausgemessen, nicht geschätzt.** Fünf Anläufe habe
  ich nach Augenmaß gemacht und jedes Mal danebengelegen — mal die Neigung, mal
  die Drehachse, mal die Perspektive. Am Ende half nur, die Vorlage stark zu
  vergrößern, vier Größen an der vordersten Karte abzulesen und die Parameter
  darauf anzupassen:

  | Maß | Vorlage | jetzt |
  |---|---|---|
  | Oberkante zur Waagerechten | 24,2° | 24,2° |
  | Seitenkante zur Senkrechten | 18,8° | 18,9° |

  Heraus kam: Drehung in der eigenen Ebene 0,48, Kippung zur Tischplatte 0,55,
  Schwenk um die Hochachse 0,055.

  **Eine Größe bleibt unsicher: Höhe zu Breite.** Über die Kantenwinkel
  gerechnet kommen 1,56 heraus, über die abgetasteten Kartenränder 1,22 — die
  Vorlage ist ein stark verkleinerter Bildschirmausschnitt, und beide Wege
  lassen sich daran nicht in Übereinstimmung bringen. Gewählt ist 1,43, also
  dazwischen. Wer eine unkomprimierte Vorlage hat, kann das entscheiden. Dazu wird jede Karte nach hinten um 8 %
  kleiner — mehr, als die Entfernung hergibt; die Vorlage ist gezeichnet, nicht
  gerechnet, also wird es hier auch gezeichnet.

  Zwei Lehren aus den Fehlversuchen stehen im Code:

  Dass Ober- und Seitenkante *verschieden* stark geneigt sind, habe ich dreimal
  mit einem kräftigen Schwenk um die Hochachse zu erklären versucht — und die
  Karten dabei schmal gemacht. Der größere Teil der Schiefe kommt aus
  **Kippung und Drehung zusammen**: Eine in ihrer Ebene gedrehte und dann
  gekippte Karte ist im Bild ein Parallelogramm.

  Und: **am kleinen Vorlagenbild darf man nicht messen.** Dort las ich für Höhe
  zu Breite 1,23 ab, kippte die Karten daraufhin fast flach — sie wurden
  quadratisch. Am großen Bild sind es 1,385. Die Ecken waren im kleinen Bild
  schlicht nicht zu unterscheiden; einmal hielt ich sogar das „4"-Abzeichen für
  eine Kartenkante.

  **Die Blätter stehen auf der Platte**, nicht an ihrem Rand: Sie sitzen bei
  0,78 der Tischhalbachsen statt bei 0,9 und eine Spur höher, sodass ihre
  Unterkante auf dem Filz aufsetzt. Zwei Dinge mussten dabei nachrücken — die
  Namensschilder (sie saßen plötzlich weit weg von den Karten, zu denen sie
  gehören) und die Trumpfkarte: Links ist zwischen dem Blatt des Nachbarn und
  dem Ablagestapel keine Kartenbreite mehr frei, rechts schon.

  **Größe und Ort kommen aus derselben Vorlage, gemessen als Anteil des
  Bildes.** Das hatte ich lange übersehen: Ich hatte nur Ausschnitte
  verglichen, nie die Gesamtansicht. An ihr gemessen waren die fremden Karten
  fast doppelt so groß wie in der Vorlage und saßen viel zu weit innen.

  | Maß (Anteil am Bild) | Vorlage | jetzt |
  |---|---|---|
  | Höhe einer fremden Karte | 14,9 % | 13,5 % |
  | linkes Blatt, Mitte | 15,8 % | 14,7 % |
  | rechtes Blatt, Mitte | 83,9 % | 85,9 % |
  | Höhe einer eigenen Karte | 19,3 % | 17 % |
  | Höhe der obersten Stapelkarte | 17,3 % | 17 % |

  Damit beides zugleich gehen konnte — Blätter am Bildrand **und** auf dem
  Tisch —, musste die Kamera ein Viertel näher heran: In der Vorlage füllt die
  Spielfläche das ganze Bild, unser Tisch nahm nur zwei Drittel der Breite
  ein. Alles Übrige hing daran und wurde nachgezogen: die eigene Hand (sie war
  mit 28 % viel zu groß und deckte den Ablagestapel zur Hälfte zu), der Stapel,
  die Trumpfkarte, die Namensschilder und die Ankerpunkte der Bedienung. Die
  Kartenform musste ebenfalls neu angepasst werden — sie hängt an der Kamera.

  Ein Maß bleibt daneben: Der Platz **gegenüber** sitzt bei 24,5 % statt 16,9 %
  der Bildhöhe. Weiter zurück ginge nur, wenn der Tisch in der Tiefe weniger
  gestaucht wäre — und die Stauchung ist es, die bei sechs Spielern alle Plätze
  ins Bild bringt.

  **Die Rückseite hat einen hellen Rand bekommen** (`tools/prepare-cards.mjs`).
  Das war am Ende der einzige verbliebene Unterschied zur Vorlage, und es ist
  kein Schmuck: Die Mitspieler halten ihre Blätter stark überlappend, sichtbar
  ist je Karte nur ein schmaler Streifen. Ohne Rand gehen sechs dunkle Streifen
  ineinander über und das Blatt wird ein Klotz — mit Rand liest man jede Karte
  einzeln. Das Motiv selbst bleibt unangetastet, es wird nur verkleinert in den
  Rahmen gesetzt.

  **Diese Werte hängen an der Kamera.** Wer `EYE` oder `LOOK` in `stage.ts`
  ändert, muss sie neu anpassen — sonst stimmt die Form nicht mehr.
- **Die Tischplatte ist unbeleuchtet.** Beleuchtet bekam sie vom Scheinwerfer
  einen hellen Fleck und ringsum Schatten — und damit genau die Silhouette,
  die sie nicht haben soll. Ihr Licht ist jetzt in die Textur gemalt, wie bei
  den Karten; sie ist eine Spur dunkler als die Bühne, in derselben Farbe. Was
  die Lampen im Raum noch beleuchten, ist die Zarge.
- **Die Unterlage in der Tischmitte leuchtet, statt zu schatten.** Ein dunkler
  Fleck stand gut, solange der Raum dunkel war; auf einer leuchtenden Bühne
  wurde daraus ein Loch.

Zweierlei ist beim Malen der Bühne immer wieder aufgelaufen und steht deshalb
hier:

**Die Bühne gehört nicht auf eine Kugel.** Sie war lange die Innenseite einer
Kugel um den Raum — und die Kamera sieht davon 43 der 360 Grad, also gut ein
Neuntel der Breite. Eine Textur von 1024 Bildpunkten wurde damit auf gut 1200
Bildschirmpunkte gezogen: zehnfach vergrößert. Jeder Rauschpunkt wurde zum
Flecken, und die Fläche sah aus wie grober Stoff. Jetzt ist die Bühne eine
ebene Fläche unmittelbar vor der Kamera, gemalt in Bildkoordinaten statt in
Grad. Das darf sie sein, weil die Kamera feststeht — sie sieht ohnehin immer
dasselbe Stück. Ein Bildpunkt der Textur ist damit ungefähr ein Bildpunkt am
Bildschirm.

**Hell ist nicht dasselbe wie leuchtend.** Ein aufgehelltes Violett wird blass
und grau; gesättigt bleibt es auch dunkler noch farbig. Der Unterschied zu den
Karten ist deshalb nicht die Helligkeit, sondern die Farbigkeit — die Karten
sind cremefarben, also fast ohne. Nachgemessen wird an vier Bildpunkten:
Bildecke, Fläche hinter dem Tisch, Filz und Karte.

## Stufe 2 — Karten in der Szene

- Kartentafel aus den 61 Motiven, erzeugt von `tools/prepare-cards.mjs`.
- Eine Karte als Körper mit **Dicke**: Vorderseite aus der Tafel, Rückseite,
  vier schmale Kanten.
- Anklicken über Strahlprüfung, dazu die unsichtbare Entsprechung der eigenen
  Hand für Tastatur und Vorlesehilfen.
- Die eigene Hand liegt aufgefächert am unteren Bildrand, leicht gewölbt.

**Fertig, wenn:** Man eine Partie zu Ende spielen kann — mit Maus **und** mit
Tastatur.

## Stufe 3 — Die Sitzordnung

- Sitzplätze nach Winkel um den Tisch verteilt: du unten, die anderen
  gleichmäßig darüber. Muss für 3 bis 6 Spieler aufgehen.
- Vor jedem Mitspieler seine Hand als **aufgefächerte Rückseiten**, zu seinem
  Platz gedreht — nicht als Zahl, sondern als sichtbarer Fächer, der
  schrumpft.
- Namensschild mit Ansage, Stichen und Punktestand am Platz, als HTML-Schicht
  an die Bildschirmposition des Sitzes geheftet.
- Wer am Zug ist, wird am Platz hervorgehoben.

**Fertig, wenn:** Alle Spielerzahlen sitzen sauber und die sichtbaren
Handgrößen stimmen mit dem Spielstand überein.

## Stufe 4 — Der Ablagestapel

- In der Mitte ein Stapel, auf den gelegt wird: jede Karte leicht versetzt und
  verdreht, wie hingeworfen.
- Eine gelegte Karte **fliegt vom Platz ihres Spielers** in die Mitte: Bogen,
  Drehung um die eigene Achse, Aufsetzen mit leichtem Nachfedern.
- Der gewonnene Stich zieht am Stichende zum Gewinner, statt zu verschwinden.
- Die Trumpfkarte liegt sichtbar auf dem Tisch und dreht sich beim Aufdecken
  um.

**Fertig, wenn:** Aus jedem der sechs Plätze kommt die Karte aus der richtigen
Richtung — nachprüfbar, indem in einer Partie jeder Platz einmal anspielt.

## Stufe 5 — Karten wie echte Karten

> **Zurückgenommen.** Diese Stufe wurde gebaut und nach dem ersten Spielen
> wieder abgeräumt. Was an ihre Stelle getreten ist, steht unten unter
> „Nachtrag: flache Karten". Der ursprüngliche Text bleibt stehen, weil die
> Begründung der Korrektur sonst in der Luft hinge.

Der Teil, der über das Gefühl entscheidet. Entsteht zuerst als
`prototypen/02-kartengefuehl/`, nicht im Spiel — Kartengefühl kann man nicht
messen, nur anfassen, und im Prototyp darf man es kaputt machen.

- **Gewicht:** Bewegungen mit Anlauf und Nachschwingen statt gleichförmigem
  Gleiten. Eine geworfene Karte ist schnell, eine aufgenommene träge.
- **Aufnehmen:** Beim Zeigen hebt sich die Karte, ihr Schatten wandert mit und
  wird weicher.
- **Wölbung:** Eine gehaltene Karte biegt sich leicht — das, was ohne echtes
  3D nicht ginge.
- **Werfen statt klicken:** Karte greifen und Richtung Mitte ziehen,
  Loslassen wirft sie. Der Klick bleibt als zweiter Weg bestehen.

**Fertig, wenn:** Du es spielst und es sich richtig anfühlt.

## Stufe 6 — Der Rest zieht in den Raum

- Ansageleiste als Bogen vor dem eigenen Platz.
- Rundenwertung als Tafel im Raum statt als Vorhang darüber.
- Menü und Partieende im selben Stil.

### Nachtrag: die Schicht sieht aus wie die Szene

Die Bedienung lag im Raum, aber sie sah nicht danach aus: dunkle Kästen mit
einem Rand darum, wie sie jede Seite hat. Vor einem gemalten, leuchtenden
Violett liest sich das als Aufkleber. Geändert wurde deshalb, was ein Schild
*ist*, nicht wo es liegt:

- **Ein Schild ist ein Stück Glas.** Verlauf statt Farbe (oben heller, das
  Licht kommt von oben), eine helle Oberkante als angedeutete Fase, und
  darunter ein Schein statt eines schwarzen Schattens.
- **Weichgezeichnet wird nur, was stillsteht.** `backdrop-filter` zwingt den
  Browser, den Grund darunter in jedem Bild neu weichzuzeichnen — bei acht
  Schildern, die mit der Szene wandern, ist das Arbeit für nichts: Bei knapp
  neunzig Prozent Deckung sieht man davon ohnehin nichts. Menütafel,
  Zählhilfe und Rundenanzeige stehen still und dürfen ihn behalten.
- **Auf dem Schild ist die Zahl der Gegenstand, nicht der Name.** Der Name
  wird klein, gesperrt und zurückgenommen; die Stiche gegen die Ansage werden
  groß. Nur eines davon ändert sich während des Spiels.

Dazu drei Dinge, die vorher fehlten:

- **Die Schilder liefen aus dem Bild.** Die seitlichen Plätze liegen knapp
  hinter der Tischkante, und die liegt bei einem schmalen Fenster fast am
  Bildrand: Bei vier Spielern auf 1280 Punkten stand das linke Schild bei
  −26, das rechte 22 Punkte zu weit rechts. Sie hängen weiter am Platz und
  wandern mit ihm, können ihn aber nicht mehr verlassen (`placeInside()` in
  ui.ts). Gemessen wird dafür einmal je Neuzeichnen, nicht je Bild —
  `offsetWidth` erzwingt sonst sechzigmal je Sekunde einen neuen Seitenaufbau.
- **Die Trumpfkarte sagt jetzt, was sie ist.** Ein kleines Schild unter ihr,
  in der Farbe des Trumpfs und mit ihrer Rune — und mit „ohne Trumpf", wenn
  ein Narr aufgedeckt liegt. Vorher lag dort eine Karte, die aussah wie
  vergessen.
- **Die Wertung zeigt, was die Runde gebracht hat.** Neben dem Gesamtstand
  eine Spalte mit dem Ergebnis dieser Runde (+30, −10) und darüber ein Satz
  in Worten. Der Gesamtstand allein verrät nicht, ob es gerade gut lief.

### Nachtrag: der Tisch war ein Teppich

Die Platte sah aus wie ausgelegter Teppichboden, und der Grund war keine
Gestaltungsfrage, sondern eine Zahl: **Die Filztextur war 512 Bildpunkte
groß.** Im Bild füllt die Platte gut 1150 Punkte, auf einem feinen Bildschirm
also gut 2300 Gerätepunkte — vierfach vergrößert. Jede gezeichnete Linie wurde
vier Punkte breit, jedes Körnchen ein Fleck. Dazu fehlte der Textur die
anisotrope Filterung, die die Kartentafel nebenan längst hat: Der Tisch liegt
flach und wird nach hinten stark gestaucht, und ohne sie verwischt genau der
Teil, in dem der Ablagestapel liegt.

Geändert:

- **2048 statt 512**, mit Mipmaps und anisotroper Filterung. Damit kommt
  ungefähr ein Texturpunkt auf einen Gerätepunkt. Alles Gezeichnete rechnet in
  Anteilen der Kantenlänge — bis auf Strichstärken, die stehen in Bildpunkten
  und wachsen jetzt über `px` mit.
- **Der Flaum wird gekachelt aufgetragen, nicht Punkt für Punkt.** Ein
  Durchgang über vier Millionen Bildpunkte hätte den Start sichtbar stocken
  lassen. Stattdessen wird ein Stück Rauschen gewürfelt und als Muster
  aufgelegt — mit `overlay` gegen Mittelgrau, damit die gemalte Beleuchtung
  erhalten bleibt. Ein Rauschen, das einfach darüberliegt, hellt die dunklen
  Stellen auf und macht die Platte flau.
- **Färbung statt Farbverlauf.** Ein Verlauf ist mathematisch glatt, und glatt
  sieht nach Farbfeld aus. Zweiundzwanzig riesige, blasse Flecken nehmen der
  Fläche die Gleichmäßigkeit, ohne als Flecken lesbar zu sein.
- **Das Gewebe wurde dichter und blasser.** Bei 2048 wären die alten Abstände
  als Streifen lesbar geworden. Was bleibt, ist eine Richtung im Stoff.

**Die Leistungsbremse hält nach dem Start still.** Sie senkt die Auflösung,
wenn die Bildrate länger einbricht, und zurück geht es nicht. Die ersten
Sekunden sind aber die langsamsten der ganzen Partie — Kartentafel
entschlüsseln, Texturen zur Grafikkarte schieben, Raum aufbauen. Wer da misst,
misst das Laden und rechnet den Rest des Abends unscharf. Sie schaut deshalb
erst nach fünf Sekunden hin.

**Der Rahmen um das Bild.** In der Szene selbst wurde eine Sache geändert: Der
Verlauf des Kerns fällt zur Ecke hin ab, aber gleichmäßig in alle Richtungen —
auf einem breiten Bildschirm stand in den Ecken deshalb fast dieselbe
Helligkeit wie hinter dem Tisch, und das Bild las sich als eine große violette
Fläche mit einer Scheibe darin. Der Rahmen (`paintVignette` in room.ts) legt
Gewicht an die Ränder zurück: weit außen, weich, und nie ganz schwarz — Farbe
bis in die Ecke bleibt die Regel, ihm wird nur die Helligkeit genommen. Dazu
sind Gewebe, Runenkreis und Borte des Filzes eine Spur kräftiger; sie waren so
zurückhaltend, dass die Platte eine leere Fläche war.

## Stufe 7 — Feinschliff und Absicherung

- Ruhiger Weg für `prefers-reduced-motion`: keine Flüge, keine Partikel.
- Leistungsgrenze festlegen und messen: flüssig bei 6 Spielern und voller
  Hand.
- Anschlusspunkte für Ton (Entscheidung 23) dort, wo etwas fliegt, aufsetzt
  oder eingesammelt wird.
- Erst danach das Handy auf den Raum umstellen.

---

## Reihenfolge und Prüfbarkeit

Jede Stufe ist für sich lauffähig und einzeln beurteilbar. Nach jeder gibt es
etwas zum Anschauen, so wie in Entscheidung 2.19 festgelegt.

| Stufe | Ergebnis | Beurteilbar durch |
|-------|----------|-------------------|
| 1 | Der Raum steht | Ansehen |
| 2 | Karten in der Szene, spielbar | Eine Partie, Maus und Tastatur |
| 3 | Alle sitzen am Tisch | Ansehen, 3 bis 6 Spieler |
| 4 | Karten fliegen und stapeln sich | Eine Partie spielen |
| 5 | Karten fühlen sich echt an | Prototyp anfassen |
| 6 | Bedienung liegt im Raum | Eine Partie spielen |
| 7 | Ruhig, flüssig, tonbereit | Messen |

## Nachtrag: flache Karten (Entscheidungen 4.4 und 4.5)

Gebaut wie oben beschrieben, gespielt — und an zwei Stellen zurückgenommen.
Beides fiel erst auf, als eine Partie wirklich lief:

**Die Karten lagen falsch.** Eine Karte flach auf dem Tisch, aus schräg oben
gesehen, ist im Bild kein 384:600-Rechteck mehr, sondern beinahe ein Quadrat.
Das Motiv wird mitgestaucht, und da jede Karte einen gezeichneten Rahmen mit
runden Ecken trägt, sieht das Ergebnis nicht nach Perspektive aus, sondern nach
falschem Zuschnitt. Dazu zog das Licht des Raums die cremeweißen Karten ins
Graue, und der Fokusrahmen der Tastaturhand — ein achsenparalleles Rechteck —
passte auf keine gekippte Karte mehr.

**Die Bewegung war unruhig.** Federn haben keine feste Dauer. Fiel ein
Neuzeichnen mitten in eine Bewegung, bekam die Feder ein neues Ziel bei
zufälliger Geschwindigkeit und lief anders weiter als beim Mal davor. Was als
Gewicht gedacht war, kam als Zittern an.

Beides hat dieselbe Lösung, und sie kommt aus den flachen Online-Kartenspielen:

- **Karten sind Bilder.** Keine Dicke, keine Wölbung, kein Licht darauf, keine
  Tiefenprüfung. Was vor was liegt, entscheidet eine feste Reihenfolge statt
  des Abstands zur Kamera — damit kann keine Karte mehr halb im Tisch
  versinken.
- **Gehalten heißt aufrecht, abgelegt heißt liegend.** Die eigene Hand und die
  Fächer der Mitspieler zeigen zur Kamera und behalten ihr Seitenverhältnis
  ganz. Ablagestapel und Trumpfkarte liegen auf der Platte — geneigt, aber
  nicht ganz flach: Bei voller Neigung bliebe unter dem Blickwinkel der Kamera
  nur gut die halbe Kartenhöhe übrig, und genau das war der Stauch-Eindruck.
  Bei gut drei Vierteln liegt die Karte sichtbar und bleibt trotzdem ein Bild.
  Eine gelegte Karte legt sich unterwegs hin, statt am Ziel umzuklappen.
- **Die Fächer der Mitspieler rechnen je Einheit Entfernung.** Ein Fächer
  weiter hinten bekommt größere Karten und größere Abstände und sieht dadurch
  im Bild genauso groß aus wie einer weiter vorn. Perspektivisch falsch,
  aber es ist die Anordnung, die man von diesen Spielen kennt.
- **Jede Bewegung hat eine feste Dauer und eine feste Kurve.** Ein Ziel, das
  sich nicht geändert hat, löst keine neue Bewegung aus. Der letzte Rest
  Gewicht ist ein kurzer Überschwinger beim Aufsetzen.

Was aus Stufe 5 bleibt: das Anheben unter Zeiger und Tastatur, das Ziehen zur
Tischmitte als zweiter Weg neben dem Klick, und der weiche Schatten — jetzt
nicht mehr unter der Karte auf dem Tisch, sondern hinter ihr im Bild.

Was ersatzlos entfällt: Wölbung, Kartendicke, Kantenfarbe und der Wurf mit
Drehung um die eigene Achse. `prototypen/02-kartengefuehl/` ist damit
gegenstandslos und entsteht nicht mehr.

---

## Nachtrag: aus dem Stapel wird ein Fächer

Die Blätter der Mitspieler waren ein *Stapel*: alle Karten parallel, stark
überlappend, um 28 Grad geneigt und um 0,55 zur Platte gekippt. Sie waren an
der Vorlage ausgemessen — die Tabellen oben stimmen — und sahen trotzdem
falsch aus: wie ein Bündel Karten, das jemand hingelegt und dabei verrutscht
hat, nicht wie ein Blatt, das jemand hält. **Gemessen richtig ist nicht
dasselbe wie gesehen richtig**, und das ist die eigentliche Lehre aus den
vielen Anläufen weiter oben.

Was an seine Stelle tritt, ist die Form, die eine *Hand* einer Kartenreihe
aufzwingt:

- **Ein Drehpunkt, kein Versatz.** Alle Karten hängen an einem Punkt knapp
  unter ihrer Unterkante (0,62 Kartenhöhen unter der Mitte) und stehen jede
  ein Stück weiter gedreht. Ihre Mittelpunkte liegen damit von selbst auf
  einem Kreisbogen — der Bogen ist kein Wert mehr, den man einstellt, sondern
  fällt aus dem Drehpunkt heraus. Vorher waren Neigung, Schritt, Bogen,
  Schrumpfung und Schwenk fünf Größen, die sich gegenseitig verstimmt haben.
- **Gemessen wird gegen die mittlere Karte**, nicht gegen die erste. Sonst
  wandert der ganze Fächer zur Seite, sobald eine Karte gelegt wird.
- **Der Fächerwinkel ist gedeckelt** (0,15 je Karte, zusammen höchstens 1,05).
  Bei vollem Blatt rückt der Fächer enger zusammen, statt breiter zu werden —
  genau das tut eine Hand auch.
- **Weniger gekippt: 0,26 statt 0,55.** Bei starker Kippung staucht die Karte
  im Bild so weit, dass aus dem Hochformat fast ein Quadrat wird; das war der
  größte Einzelbeitrag zum unechten Eindruck.
- **Keine Spiegelung mehr.** Sie hat den schräg stehenden Stapel auf der Platte
  geerdet. Ein gehaltener Fächer steht nicht auf dem Tisch, er wird darüber
  gehalten — die Spiegelung machte aus dem Filz eine Pfütze. Es gilt wieder der
  weiche Schatten hinter der Karte wie überall sonst.

Damit entfallen `AWAY_OVERLAP`, `AWAY_BOW`, `AWAY_BOW_TOTAL`, `AWAY_SHRINK`,
`AWAY_YAW` und die Hilfsfunktion `stack()`.

## Nachtrag: der bunte Ring ist weg

In der Tischmitte lag ein breiter Ring aus den vier Spielfarben
(`.table::before`), gedacht als Spielrichtungsanzeige. Er hat nichts angezeigt
— die Richtung steht schon im Runenkreis des Filzes — und lag als greller
Fremdkörper unter dem Ablagestapel, dort also, wo das Auge ohnehin hinsieht.
Ersatzlos entfernt.

## Nachtrag: die Rückseite im Arcade-Stil

Mit dem roten Arcade-Tisch fielen zwei Dinge an den Karten auf:

- **Die gelieferte Rückseite (fast schwarz, violetter Rand) las sich als Loch
  im Bild.** Die Blätter der Mitspieler bestehen fast nur aus Rückseiten —
  dieses eine Motiv prägt ihren ganzen Auftritt. Sie wird jetzt in
  `tools/prepare-cards.mjs` **gezeichnet statt geliefert**: violetter Verlauf
  wie die Schilder der Bedienschicht, ein Goldring als Siegel, darin die vier
  Runen in den Spielfarben. Das gelieferte Motiv ruht unter `assets/`.
- **Unter jeder eigenen Handkarte stand ein goldener Balken.** Das war kein
  Element der Szene, sondern der Sockel-Schatten, den das Arcade-Thema allen
  Knöpfen gibt — auch den unsichtbaren Tastatur-Knöpfen (`.handkey`), die
  hinter den Handkarten liegen. Lehre: Wer einen Knopf unsichtbar macht, muss
  alles zurücksetzen, was ein Thema später an `button` hängt; `background`
  und `border` reichen nicht, `box-shadow` gehört dazu.

## Was bewusst nicht dazugehört

Ton, Statistik, Übersetzung, Online-Betrieb und das Handy-Layout. Die stehen
weiter auf der Liste, aber nicht in diesem Umbau.
