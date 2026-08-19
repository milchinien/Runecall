# Runecall — Offene Fragen (Multiple Choice)

> **Status: alle Fragen beantwortet.** Dieses Dokument bleibt als Begründung
> erhalten — welche Alternativen zur Wahl standen und was für sie sprach.
> Die getroffenen Entscheidungen stehen in [00-ENTSCHEIDUNGEN.md](00-ENTSCHEIDUNGEN.md).

Alle Entscheidungen, die vor dem ersten Code getroffen werden sollten.
Jede Frage hat eine **Empfehlung** ⭐ — wenn du eine Frage überspringst, wird
die Empfehlung verwendet.

Antworten am einfachsten kurz als Liste, z. B. `1B, 2A, 3⭐, 4C, …`

---

## A · Umfang und Spielmodus

### 1. Gegen wen spielt man in Version 1?
- **A** ⭐ Einzelspieler gegen Computergegner
- **B** Hotseat — mehrere Menschen an einem PC, Verdeck-Screen zwischen den Zügen
- **C** Beides frei mischbar: pro Sitzplatz Mensch oder Bot
- **D** Online-Multiplayer über Netzwerk

### 2. Welche Spielerzahlen werden unterstützt?
- **A** ⭐ Alle: 3–6 Spieler
- **B** Erstmal nur 4 Spieler, Rest später
- **C** Nur 3 und 4 Spieler (kürzere Partien)

### 3. Wie viele Bot-Schwierigkeitsgrade?
- **A** ⭐ Drei: Leicht / Normal / Schwer
- **B** Nur einer, dafür richtig gut
- **C** Zwei: Normal / Schwer
- **D** Drei plus separate Persönlichkeiten (vorsichtig, aggressiv, unberechenbar)

### 4. Wie lang ist eine Partie?
- **A** ⭐ Volle Länge — alle Runden (bei 4 Spielern 15 Runden, ca. 30–45 Min.)
- **B** Zusätzlich eine Kurzpartie wählbar (z. B. nur Runden 1–8)
- **C** Rundenzahl frei einstellbar
- **D** Zusätzlich ein „Einzelrunden“-Modus zum Üben

### 5. Wie steigt die Kartenanzahl über die Runden?
- **A** ⭐ Klassisch aufsteigend: 1, 2, 3, … bis Maximum
- **B** Auf und ab: 1 … Maximum … 1 (doppelte Partielänge)
- **C** Beides wählbar

---

## B · Regelvarianten

### 6. Geber-Einschränkung bei der Ansage?
Der Geber darf als Letzter keine Zahl nennen, die die Summe exakt auf die
Stichzahl bringt — damit liegt garantiert jemand daneben.
- **A** ⭐ Aus (klassisches Grundspiel) — **entschieden**
- **B** An
- **C** In den Optionen umschaltbar, Standard aus

### 7. Sind die Ansagen offen oder verdeckt?
- **A** ⭐ Offen, reihum — der Geber sagt zuletzt an und hat dadurch einen Vorteil
- **B** Verdeckt und gleichzeitig, dann alle aufdecken
- **C** In den Optionen umschaltbar

### 8. Aufgedeckter Magier bestimmt den Trumpf — wer wählt?
- **A** ⭐ Der Geber wählt die Farbe, nachdem er seine Hand gesehen hat
- **B** Zufällige Farbe
- **C** Keine Trumpffarbe in dieser Runde
- **D** Umschaltbar

### 9. Stich, in dem nur Narren liegen — wer gewinnt?
- **A** ⭐ Der zuerst gespielte Narr
- **B** Der Spieler, der den Stich eröffnet hat (identisch mit A, außer bei
  Narr-Anspiel-Sonderfällen)
- **C** Niemand — der Stich verfällt, keiner bekommt ihn angerechnet

### 10. Wie werden weitergehende Sonderkarten behandelt?
- **A** ⭐ Vorerst gar nicht, aber die Architektur bleibt dafür offen
- **B** Gar nicht, und auch keine Vorbereitung — schlankerer Code
- **C** Direkt mit einplanen und teilweise umsetzen

### 11. Gleichstand am Partieende?
- **A** ⭐ Geteilter Sieg
- **B** Es gewinnt, wer mehr Ansagen exakt getroffen hat
- **C** Eine Entscheidungsrunde wird gespielt

---

## C · Bedienung und Spielgefühl

### 12. Was passiert mit Karten, die man gerade nicht spielen darf?
- **A** ⭐ Sichtbar, aber abgedunkelt und nicht anklickbar; beim Klickversuch
  kurzer Hinweis „Du musst Grün bedienen“
- **B** Nur abgedunkelt, kommentarlos
- **C** Spielbare Karten werden stattdessen hervorgehoben
- **D** Gar keine Markierung — der Spieler muss selbst aufpassen (Regelverstoß
  wird abgelehnt)

### 13. Wie wird die Hand sortiert?
- **A** ⭐ Automatisch nach Farbe und Wert, Trumpf zuerst, Magier/Narr außen
- **B** Automatisch, aber Sortierung per Klick umschaltbar
- **C** Karten per Drag & Drop selbst umsortierbar
- **D** Unsortiert in Austeilreihenfolge

### 14. Wie sagt man an?
- **A** ⭐ Eine Reihe Zahlen-Buttons 0..n, direkt anklickbar
- **B** Plus/Minus-Stepper mit Bestätigung
- **C** Zahlentasten der Tastatur plus Buttons
- **D** Schieberegler

### 15. Kartenzähl-Hilfe — sieht man, welche Karten schon gespielt wurden?
- **A** ⭐ Optional zuschaltbar, standardmäßig aus
- **B** Immer sichtbar — bequemer, aber leichter
- **C** Nie — man muss selbst mitzählen wie am echten Tisch
- **D** Nur der letzte Stich ist nochmal einsehbar

### 16. Spieltempo der Bots
- **A** ⭐ Kurze Verzögerung (ca. 0,6 s pro Zug), Geschwindigkeit in den Optionen
  einstellbar, Klick überspringt die Wartezeit
- **B** Feste, gemütliche Verzögerung
- **C** Sofort, ohne Verzögerung
- **D** Bots „denken“ unterschiedlich lange, je nach Situation

### 17. Rückgängig machen?
- **A** ⭐ Nein — eine gespielte Karte ist gespielt, wie am echten Tisch
- **B** Ja, ein Zug zurück, solange die Bots noch nicht reagiert haben
- **C** Nur in einem separaten Übungsmodus

### 18. Hilfe für Einsteiger bei der Ansage?
- **A** ⭐ Ein zuschaltbarer Hinweis, der die eigene Handstärke grob einschätzt
- **B** Keine Hilfe
- **C** Ein Tutorial für die erste Partie
- **D** Nachträgliche Analyse: „Deine Ansage von 3 war riskant, weil …“

### 19. Was passiert nach jedem Stich?
- **A** ⭐ Kurze Pause, Gewinnerkarte hervorgehoben, dann zieht der Stich zum Gewinner
- **B** Sofort weiter, nur eine kleine Einblendung
- **C** Pause bis zum Klick des Spielers

---

## D · Darstellung

### 20. Grafischer Grundstil
- **A** ⭐ Sauber und funktional — klare Flächen, kräftige Farben, hohe Lesbarkeit
- **B** Warm und thematisch — Holztisch, Kerzenlicht, verzierte Karten
- **C** Minimalistisch-modern — flache Flächen, viel Weißraum, Typografie
- **D** Comichaft-verspielt, nah am Original

### 21. Wie werden die Karten gestaltet?
- **A** ⭐ Rein typografisch/geometrisch: große Zahl, Farbfläche, Symbol für die
  Farbe. Kein Zeichenaufwand, perfekt lesbar
- **B** Eigene Illustrationen für Magier und Narr, Zahlenkarten schlicht
- **C** Durchgehend illustrierte Karten
- **D** Mehrere Kartendesigns zur Auswahl

### 22. Wie viel Animation?
- **A** ⭐ Dezent: Karten gleiten, Stich zieht ein, Punkte zählen hoch
- **B** Praktisch keine — alles springt sofort
- **C** Aufwendig: Fächern, Kippen, Schatten, Partikel bei besonderen Karten

### 23. Ton?
- **A** ⭐ Dezente Soundeffekte (Karte legen, Stich, Wertung), keine Musik
- **B** Effekte plus ruhige Hintergrundmusik
- **C** Komplett stumm
- **D** Effekte, Musik und Sprachausgabe für die Ansagen

### 24. Barrierefreiheit der vier Farben
- **A** ⭐ Jede Farbe bekommt zusätzlich ein eigenes Symbol — immer sichtbar
- **B** Symbole nur im zuschaltbaren Farbenblind-Modus
- **C** Nur Farbe, keine Symbole

### 25. Sprache
- **A** ⭐ Nur Deutsch
- **B** Deutsch und Englisch umschaltbar
- **C** Deutsch, aber alle Texte in einer Datei gebündelt für spätere Übersetzung

### 26. Bildschirmformat
- **A** ⭐ Desktop, Querformat, skaliert mit der Fenstergröße
- **B** Desktop plus Tablet
- **C** Auch Handy im Hochformat (deutlich anderes Layout nötig)

---

## E · Technik

### 27. Technologie
- **A** ⭐ TypeScript + Vite im Browser — wie Wavebreaker und Chromatic
- **B** TypeScript + Vite, zusätzlich als Desktop-App verpackt (Electron/Tauri)
- **C** C# / .NET als echte Windows-Anwendung
- **D** Python mit Desktop-UI

### 28. Wird der Spielstand gespeichert?
- **A** ⭐ Laufende Partie wird automatisch gesichert und kann fortgesetzt werden
- **B** Nur die Bestenliste/Statistik, laufende Partien nicht
- **C** Gar nichts speichern
- **D** Automatisch speichern plus manuelle Spielstände

### 29. Statistiken?
- **A** ⭐ Einfach: gespielte Partien, Siege, Trefferquote der Ansagen, bester Score
- **B** Keine
- **C** Ausführlich: Trefferquote nach Rundengröße, Nullansagen-Quote, Punkteverlauf
- **D** Ausführlich plus vollständiges Partie-Archiv zum Nachspielen

### 30. Wie viel Testabdeckung für die Regel-Engine?
- **A** ⭐ Alle Beispiele aus dem Regelwerk als Tests, plus Zufallspartien gegen
  die Invarianten aus Abschnitt 9
- **B** Nur die Beispiele aus dem Regelwerk
- **C** Keine Tests, manuell prüfen
- **D** Volle Abdeckung inklusive Bot-Verhalten

### 31. Reproduzierbare Partien über einen Seed?
- **A** ⭐ Ja — Seed eingebbar, wird angezeigt, Partie exakt wiederholbar
- **B** Ja, aber nur intern für Tests
- **C** Nein

### 32. Wie soll es am Ende gestartet werden?
- **A** ⭐ Lokal per `npm run dev` bzw. als gebautes Verzeichnis, das man im
  Browser öffnet
- **B** Zusätzlich irgendwo statisch gehostet
- **C** Als installierbare Windows-Anwendung mit Verknüpfung

---

## F · Vorgehen

### 33. In welcher Reihenfolge soll gebaut werden?
- **A** ⭐ Erst die Regel-Engine mit Tests und einer Text-Ausgabe zum Prüfen,
  dann Bots, dann die grafische Oberfläche
- **B** Erst eine sichtbare, spielbare Oberfläche, Regeln parallel nachziehen
- **C** Alles zusammen in einem Rutsch
- **D** Erst ein klickbarer Entwurf der Oberfläche zum Anschauen, dann der Rest

### 34. Wie eng willst du eingebunden sein?
- **A** ⭐ Nach jedem größeren Abschnitt kurz zeigen und abstimmen
- **B** Einmal komplett durchbauen, dann gemeinsam durchgehen
- **C** Nach jedem einzelnen Schritt abstimmen

### 35. Soll es ein Git-Repository geben?
- **A** ⭐ Ja, gleich zu Beginn initialisieren
- **B** Nein, erstmal nur Dateien
- **C** Ja, und zusätzlich auf GitHub veröffentlichen
