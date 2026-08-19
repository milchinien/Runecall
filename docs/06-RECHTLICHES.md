# Rechtliche Einordnung

**Keine Rechtsberatung.** Zusammenstellung des allgemein Bekannten zur
Einordnung des Projektrisikos. Bei ernsthaften Veröffentlichungsabsichten
lohnt eine kurze anwaltliche Prüfung — für die Namenswahl reicht in der Regel
ein Blick ins Markenregister.

---

## Übersicht

| Gegenstand | Geschützt? | Konsequenz |
|---|---|---|
| Spielregeln, Spielmechanik | nein | frei umsetzbar |
| Punkteformel `20 + 10 × Ansage` | nein | frei umsetzbar |
| Rundenaufbau, Bedienpflicht, Stichlogik | nein | frei umsetzbar |
| Kartenzusammensetzung (52 + 4 + 4) | nein | frei umsetzbar |
| **Name „Wizard“** | **ja, Marke** | **ersetzt durch „Runecall“** ✔ |
| Illustrationen bestehender Ausgaben | ja, Urheberrecht | nicht übernehmen |
| Logo, Kartenrücken, Schachtelgestaltung | ja | nicht übernehmen |
| Wortlaut der gedruckten Spielanleitung | ja | nicht abschreiben |
| Begriffe „Magier“, „Narr“ | nein | frei verwendbar |

---

## 1. Spielregeln sind frei

Zwei getrennte Gründe:

**Urheberrecht** schützt die konkrete Ausformulierung eines Textes, nicht die
Idee dahinter. Die *Anleitung* von AMIGO ist geschützt — die *Regel* „wer nicht
bedienen kann, darf abwerfen oder trumpfen“ ist es nicht.

**Patentrecht** greift gar nicht erst: § 1 Abs. 3 Nr. 2 PatG (und Art. 52 EPÜ)
nehmen „Pläne, Regeln und Verfahren … für Spiele“ ausdrücklich von der
Patentierbarkeit aus. Selbst wenn es je ein Schutzrecht gegeben hätte, wäre es
bei einem Spiel von 1984 längst abgelaufen.

**Historische Einordnung:** Wizard ist selbst eine Variante des traditionellen,
gemeinfreien Stichansage-Spiels *Oh Hell* (auch *Blackout*, *Stiche raten*),
das bis in die 1930er zurückgeht. Ken Fishers eigener Beitrag von 1984 waren im
Kern die Zauberer- und Narrenkarten.

**Praktischer Beleg:** Es existieren kommerziell vertriebene Spiele mit
derselben Mechanik in anderem Gewand — *Skull King* etwa ist im Kern dasselbe
Spiel mit Piratenthema.

→ Das Regelwerk in [01-REGELWERK.md](01-REGELWERK.md) kann unverändert
umgesetzt werden.

## 2. Der Name ist das eigentliche Thema

„Wizard“ ist für Spiele als Marke eingetragen. Markenrecht greift nach
§ 14 MarkenG allerdings nur bei Benutzung **im geschäftlichen Verkehr**.

| Nutzung | Risiko |
|---|---|
| Privater Rechner, eigenes WLAN, Familie und Freunde | praktisch keins |
| Interner Ordner- und Repository-Name | keins |
| Öffentlich erreichbarer Server, öffentliche Downloadseite | vorhanden |
| App-Store (Google Play, Microsoft Store, App Store) | deutlich |

Bei Markenbeschwerden entfernen App-Stores erfahrungsgemäß zuerst und klären
später. Ein Rauswurf nach Veröffentlichung kostet Bewertungen, Verlinkungen und
Nutzer — deshalb ist die Umbenennung **vor** dem ersten öffentlichen Build der
mit Abstand billigste Zeitpunkt. Danach steckt der Name in Repository,
Paketnamen, App-ID, Icons, Screenshots und Store-Text.

**Ebenfalls vermeiden:** den Markennamen als Aufhänger in Titel oder
Beschreibung („Das bekannte Wizard für unterwegs“). Unbedenklich ist der
Verweis auf die gemeinfreie Wurzel, etwa „nach dem klassischen
Stichansage-Prinzip“ oder „inspiriert vom traditionellen *Oh Hell*“.

**Selbst prüfen:** [DPMA-Register](https://register.dpma.de) und
[EUIPO eSearch](https://euipo.europa.eu), Nizza-Klassen **9** (Software) und
**28** (Spiele). Kostenlos und in wenigen Minuten erledigt.

## 3. Grafik

Die AMIGO-Illustrationen sind urheberrechtlich geschützt und scheiden
vollständig aus — auch als Vorlage zum Nachzeichnen.

Die Entscheidung „comichaft, nah am Original“ bezieht sich deshalb auf den
**Stil**: freundlich, verspielt, leicht überzeichnet. Ein Stil als solcher ist
nicht schutzfähig; die konkreten Figuren sind es. Bei den KI-generierten
Motiven bedeutet das: eigenständige Charaktere, keine Nachbildung der bekannten
Zauberer- und Narrenfiguren, kein nachempfundener Kartenrücken, kein an das
Original angelehnter Schriftzug.

Dasselbe gilt für die **Aufmachung insgesamt** (Trade Dress): Farbwelt, Logo
und Kartenrückseite sollen erkennbar eigen sein.

## 4. Was unverändert bleiben kann

- Alle Regeln und Sonderfälle
- Die Wertung `20 + 10 × Ansage` bzw. `−10 × Abweichung`
- Deckaufbau: 4 Farben × 1–13, 4 Magier, 4 Narren
- Rundenzahl nach Spielerzahl
- Kartenbezeichnungen wie „Magier“ und „Narr“ — gewöhnliche deutsche Wörter
  in beschreibender Verwendung
- Die Farbnamen Rot, Gelb, Grün, Blau

## 5. Was daraufhin geändert wurde

Stand: alles umgesetzt, mit einer Ausnahme (Punkt 6).

| # | Maßnahme | Status |
|---|----------|--------|
| 1 | Spielname **Runecall** statt des Markennamens | ✔ in allen Dokumenten |
| 2 | Kartennamen **Magier** / **Narr** (engl. *Mage* / *Jester*) | ✔ in allen Dokumenten |
| 3 | Herkunftsverweis nur auf das gemeinfreie *Oh Hell* | ✔ |
| 4 | Beispiel-Raumcode `RUNE-4711` statt `WZRD-…` | ✔ |
| 5 | Regeln unverändert übernommen | ✔ unkritisch |
| 6 | Projektordner `…\Wizard` → `…\Runecall` | offen (Frage 3.5) |

**Warum in diesem Dokument der Markenname trotzdem steht:** Es geht hier
ausdrücklich darum, welche Bezeichnung *vermieden* wird und warum. Ein fremdes
Zeichen zu nennen, um es abzugrenzen, ist beschreibende Nennung und genau das
Gegenteil einer markenmäßigen Benutzung. In allen anderen Dokumenten und im
Spiel selbst taucht der Name nicht mehr auf.

## 6. Namensprüfung Runecall

Die Recherche nach bestehenden Spielen und Apps gleichen Namens blieb ohne
Treffer. Zwei Hinweise dazu:

- In derselben Branche existiert die Spieleplattform **Rune** (rune.ai). Das
  Zeichen ist kürzer und anders, aber die Nähe ist vorhanden und wurde bewusst
  in Kauf genommen.
- Eine Websuche ersetzt keine Registerrecherche. Vor der ersten
  Veröffentlichung sollte „Runecall“ im [DPMA-Register](https://register.dpma.de)
  und bei [EUIPO eSearch](https://euipo.europa.eu) gegengeprüft werden,
  Nizza-Klassen **9** und **28**.

Zwei Namen wurden bei der Prüfung ausgeschieden: *Fortune & Folly* ist mehrfach
belegt, und *Foretold* liegt zu nah an *Foretell*, einem bereits existierenden
Stichansage-Spiel mit identischer Mechanik.

## 7. Laufende Regeln für die Umsetzung

- **Bildmaterial eigenständig** erzeugen — Stil ja, Motive nein.
- In Store-Texten und Beschreibungen auf *Oh Hell* verweisen, nie auf eine Marke.
- Keine nachempfundene Kartenrückseite, kein angelehnter Schriftzug, keine
  übernommene Farbwelt.
