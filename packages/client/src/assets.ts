/**
 * Pfade zu mitgelieferten Dateien unter public/.
 *
 * Die erzeugte Kartenliste schreibt absolute Pfade wie `/cards/…`. Die stimmen
 * nur, solange das Spiel auf einer eigenen Adresse liegt. Auf GitHub Pages
 * haengt es unter `/Runecall/`, und dann zeigt jeder absolute Pfad daneben.
 * Deshalb laeuft alles, was aus public/ geladen wird, durch diesen Helfer.
 *
 * `import.meta.env.BASE_URL` ist genau das, was in vite.config.ts als `base`
 * steht: im Entwicklungsbetrieb `/`, im Bau `./`.
 */
export function assetUrl(pfad: string): string {
  const basis = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${basis}/${pfad.replace(/^\//, '')}`
}
