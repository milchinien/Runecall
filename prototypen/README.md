# Prototypen

Werkstatt. Hier wird ausprobiert, nicht gebaut.

Jeder Prototyp in diesem Ordner beantwortet **eine** Frage — „fühlt sich das
Kartenfächern auf dem Handy gut an?“, „ist diese Bot-Strategie stark genug?“,
„funktioniert das Ansage-Layout bei sechs Spielern?“ — und wird danach
weggeworfen. Was funktioniert hat, wird im echten Spiel **neu geschrieben**,
nicht kopiert.

## Die Regel: keine Verbindung zum echten Spiel

Ein Prototyp darf **nichts** aus `packages/` importieren, und `packages/` darf
**nie** etwas von hier importieren. Kein gemeinsamer Build, kein gemeinsames
`node_modules`, kein gemeinsames `package.json`. Jeder Prototyp steht für sich
allein und ist einzeln startbar.

Der Grund: Sobald ein Prototyp am echten Code hängt, kann man ihn nicht mehr
schnell kaputtmachen — und genau das ist sein Zweck. Ein Prototyp, den man
vorsichtig behandeln muss, ist keiner mehr.

Das gilt auch andersherum: Wenn hier etwas Unsinniges entsteht, kann es das
echte Spiel nicht anstecken. Der ganze Ordner ist jederzeit löschbar, ohne dass
irgendwo etwas fehlt.

## Aufbau

```
prototypen/
├─ README.md            diese Datei
├─ 01-<thema>/          ein Prototyp, für sich lauffähig
├─ 02-<thema>/
└─ …
```

Benennung: laufende Nummer plus kurzes Thema, klein geschrieben, mit
Bindestrichen — z. B. `01-kartenfaecher`, `02-bot-vergleich`,
`03-handy-layout`. Die Nummer sagt, in welcher Reihenfolge etwas entstanden
ist; sie wird nie wiederverwendet, auch wenn ein Prototyp gelöscht wird.

## Was in einem Prototyp steht

Jeder Prototyp bekommt eine eigene `README.md` mit drei Zeilen:

- **Frage** — was soll herausgefunden werden?
- **Start** — welcher Befehl bringt ihn zum Laufen?
- **Ergebnis** — was kam heraus? (wird nachgetragen, wenn die Frage
  beantwortet ist)

Der Rest ist frei. Kein Zwang zu Tests, keine Rücksicht auf Struktur, keine
Rücksicht auf Handy und PC gleichzeitig. Wenn eine Frage sich mit einer
einzelnen HTML-Datei beantworten lässt, ist eine einzelne HTML-Datei die
richtige Antwort.

## Nicht hierher gehört

Alles, was länger leben soll als die Frage, die es beantwortet: die
Spielregeln, die Bots, die richtige Oberfläche, der Server. Die kommen nach
[docs/04-TECHNIK-EMPFEHLUNG.md](../docs/04-TECHNIK-EMPFEHLUNG.md) in
`packages/`.
