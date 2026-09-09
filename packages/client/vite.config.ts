import { mkdirSync, writeFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'

/**
 * Nur im Dev-Betrieb: nimmt einen Screenshot der Szene als Daten-URL entgegen
 * und legt ihn unter .shots/ ab. Werkzeuge koennen so Bilder aus dem Browser
 * ziehen, ohne dass der Client etwas davon weiss.
 */
const shotSink = (): Plugin => ({
  name: 'shot-sink',
  configureServer(server) {
    server.middlewares.use('/__shot', (req, res) => {
      let body = ''
      req.on('data', (chunk: Buffer) => (body += chunk))
      req.on('end', () => {
        const match = /^data:image\/(\w+);base64,(.+)$/.exec(body)
        if (match === null) {
          res.statusCode = 400
          res.end('keine Daten-URL')
          return
        }
        mkdirSync('.shots', { recursive: true })
        const file = `.shots/shot-${Date.now()}.${match[1]}`
        writeFileSync(file, Buffer.from(match[2] ?? '', 'base64'))
        res.end(file)
      })
    })
  },
})

/**
 * Der Port kommt aus der Umgebung, sobald einer vorgegeben ist. So koennen
 * mehrere Entwicklungsserver nebeneinander laufen, ohne sich den Port
 * streitig zu machen. Ohne Vorgabe bleibt es bei Vites 5173.
 */
const port = Number(process.env.PORT) || 5173

export default defineConfig({
  // Das Spiel liegt auf GitHub Pages unter /Runecall/, nicht auf einer
  // eigenen Adresse. Mit relativer Basis stimmen die Pfade an beiden Orten.
  base: './',
  plugins: [shotSink()],
  server: {
    port,
    // host: true macht den Server auch im eigenen WLAN erreichbar --
    // damit laesst sich das Handy-Layout auf einem echten Telefon testen,
    // statt nur im verkleinerten Browserfenster.
    host: true,
  },
  build: {
    target: 'es2022',
  },
})
