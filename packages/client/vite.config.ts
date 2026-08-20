import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    // host: true macht den Server auch im eigenen WLAN erreichbar --
    // damit laesst sich das Handy-Layout auf einem echten Telefon testen,
    // statt nur im verkleinerten Browserfenster.
    host: true,
  },
  build: {
    target: 'es2022',
  },
})
