# Online spielen

Schritt 5 aus [04-TECHNIK-EMPFEHLUNG.md](04-TECHNIK-EMPFEHLUNG.md) ist gebaut:
Der eigene Raum mit Raumcode läuft über einen echten Server. Was noch fehlt,
ist die Spielersuche — dazu unten mehr.

---

## Die kurze Fassung

```
   Browser                    Cloudflare                 Browser
  ┌────────┐   WebSocket    ┌────────────┐  WebSocket   ┌────────┐
  │ Client │ ─────────────▶ │  RoomDO    │ ◀─────────── │ Client │
  │        │ ◀───────────── │  MPTYF     │ ───────────▶ │        │
  └────────┘   PlayerView   └────────────┘  PlayerView  └────────┘
   sieht nur                 kennt alles                 sieht nur
   die eigene Hand           (GameState)                 die eigene Hand
```

**Ein Durable Object je Raum.** Der Raumcode *ist* der Name des Objekts.
`idFromName("MPTYF")` liefert weltweit dasselbe Objekt, also sitzen alle
Spieler mit demselben Code zwangsläufig im selben Prozess — ohne eine einzige
Zeile Verteilungslogik.

**Der Server ist autoritativ.** Der vollständige `GameState` verlässt das
Durable Object nie. Hinaus geht immer nur `playerView(state, seat)`. Das ist
bei einem Spiel mit verdeckten Karten nicht Feinschliff, sondern der Grund für
den ganzen Aufbau: Ein Client, der alle Hände kennt, ist ein Client, mit dem
man perfekt spielt. Jeder Zug wird auf dem Server gegen dieselbe Engine
geprüft, die auch in den Tests läuft; die Prüfung im Client ist Bequemlichkeit
für den Spieler, nicht die Absicherung.

---

## Warum Cloudflare Workers

Die Anforderung war: **dauerhaft kostenlos**. Durable Objects sind seit 2025
im Workers-Free-Tarif enthalten — 100 000 Anfragen pro Tag, 5 GB Speicher,
13 000 GB-s Rechenzeit täglich. Für eine Handvoll Freunde ist das um
Größenordnungen mehr als nötig.

Zwei Dinge sind deshalb keine Geschmacksfrage:

- **SQLite-Speicher** (`new_sqlite_classes` in `wrangler.toml`). Im kostenlosen
  Tarif sind ausschließlich Durable Objects mit SQLite-Hintergrund erlaubt.
- **Winterschlaf** (`acceptWebSocket` statt `ws.accept()`). Ein Raum, in dem
  gerade jemand nachdenkt, darf aus dem Speicher fallen, ohne dass die
  Verbindungen abreißen. Sonst liefe die Uhr, während niemand spielt.

Die Alternativen scheiterten genau an „kostenlos für immer": Render und
Railway fahren freie Dienste nach kurzer Ruhe herunter und starten dann
zäh wieder an, Fly.io verlangt eine Kreditkarte.

---

## Was passiert, wenn jemand rausfliegt

| Fall | Was der Raum tut |
|------|------------------|
| Verbindung bricht kurz ab | Der Client verbindet sich von selbst neu (5 Versuche, wachsende Abstände) und bekommt über sein Merkmal **denselben Platz** zurück. |
| Jemand ist länger weg | Nach 2,5 Sekunden spielt ein Bot seine Karten weiter. Kommt er zurück, übernimmt er wieder. |
| Der Wirt verschwindet | Der nächste Anwesende darf starten. Sonst stünde der Raum still, nur weil einem das Netz weggebrochen ist. |
| Niemand rührt sich | Nach zwölf Stunden räumt sich der Raum selbst ab. |
| Die Seite wird neu geladen | Das Merkmal liegt im `sessionStorage` und gilt nur für diesen Raum. |

Freie Plätze übernehmen von Anfang an Bots — dieselben wie offline. Weil
Server und Bots dieselbe Engine benutzen, ist das kein Sonderfall, sondern
derselbe Zug aus einer anderen Hand.

---

## Das Tempo gehört dem Client

Der Server meldet **jeden einzelnen Zug** sofort. Würde der Client jede
Meldung gleich zeichnen, sähe man keine vier Karten fliegen, sondern einen
fertigen Stich — die Meldungen treffen im selben Sekundenbruchteil ein.

Deshalb reiht `online.ts` die eingehenden Sichten auf und spielt sie im
eingestellten Tempo ab, mit derselben Stichpause wie das lokale Spiel. Die
Zeit ist eine Frage der Oberfläche und bleibt es auch online.

Ausnahme: Nach einem Verbindungsabbruch trägt die Nachricht `sync`. Dann ist
der neue Stand kein nächster Schritt, sondern der einzige, der noch gilt — die
Warteschlange wird verworfen.

---

## Selbst ausprobieren

Zwei Fenster, zwei Befehle:

```bash
npm run dev --workspace @runecall/server    # Server auf :8787
PORT=5180 VITE_SERVER_URL=http://127.0.0.1:8787 npm run dev
```

Dann im Browser „Spiel erstellen → Raum eröffnen", den Code ablesen und in
einem zweiten Fenster über „Spielen → Freund beitreten" hineingehen.

Ohne Browser geht es auch — ein Durchlauf über das echte Protokoll, der
nebenbei prüft, dass kein Client fremde Hände zu sehen bekommt:

```bash
node tools/online-smoke.mjs
```

---

## Veröffentlichen

Einmalig einzurichten, danach läuft es über
[`.github/workflows/server.yml`](../.github/workflows/server.yml):

1. Auf `dash.cloudflare.com` ein kostenloses Konto anlegen.
2. API-Token erzeugen, Vorlage **Edit Cloudflare Workers**.
3. Im Repository unter *Settings → Secrets and variables → Actions*:
   - Secret `CLOUDFLARE_API_TOKEN`
   - Secret `CLOUDFLARE_ACCOUNT_ID`
   - Variable `RUNECALL_SERVER_URL` = `https://runecall-server.<name>.workers.dev`

Die Variable braucht auch der Client: `pages.yml` reicht sie beim Bauen
durch, damit das Spiel weiß, wohin es sich verbinden soll.

Wer lieber von Hand veröffentlicht:

```bash
npx wrangler login
npm run deploy --workspace @runecall/server
```

**Hinweis zu CORS:** `packages/server/src/index.ts` führt eine kurze Liste
erlaubter Herkünfte. Läuft das Spiel später unter einer anderen Adresse, muss
sie dort hinein.

---

## Was noch fehlt

**Die Spielersuche (Ranked).** Sie braucht etwas, das es hier noch nicht gibt:
eine Vermittlung *über alle Räume hinweg*. Ein Durable Object je Raum reicht
dafür nicht — es käme ein einzelnes Wartezimmer-Objekt dazu, das Suchende
sammelt und sie zu viert in einen frischen Raum schickt. Bis dahin sucht die
Spielersuche sichtbar, findet niemanden und lässt Bots einspringen.

**Rangpunkte für die anderen.** `rank.ts` verbucht nur den eigenen Platz. Das
ist richtig, solange nur der eigene Browser zählt — sobald es Wertung über
mehrere Leute gibt, gehört sie auf den Server.

**Regeln im Warteraum ändern.** Der Server kann es (`set-rules`), der
Wartebildschirm zeigt die Regler noch nicht. Wer etwas ändern will, verlässt
den Raum und eröffnet ihn neu.
