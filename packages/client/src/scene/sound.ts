/**
 * Anschlusspunkte fuer den Ton.
 *
 * Ton ist Entscheidung 23 und steht noch nicht an. Was hier steht, ist
 * ausschliesslich die Stelle, an der er spaeter andockt: Die Szene meldet,
 * *dass* etwas geworfen wurde, aufgesetzt ist oder eingesammelt wird -- nicht,
 * wie es klingt.
 *
 * Der Grund fuer diese Vorarbeit steht in Stufe 7: Diese Meldungen nachtraeglich
 * einzuziehen hiesse, jede Bewegung in `table.ts` noch einmal aufzumachen. Sie
 * jetzt zu setzen kostet ein paar Zeilen, und der Tonteil ist spaeter eine
 * einzige Datei statt einer Schleifspur durch die Darstellung.
 *
 * Solange niemand zuhoert, passiert nichts.
 */

/** Was in der Szene geschieht und hoerbar werden soll. */
export type SceneSound =
  /** Eine Karte verlaesst eine Hand. */
  | 'throw'
  /** Eine Karte setzt auf dem Ablagestapel auf. */
  | 'land'
  /** Der Stich wandert zum Gewinner. */
  | 'collect'
  /** Die Trumpfkarte dreht sich um. */
  | 'flip'
  /** Eine Karte wird unter dem Zeiger angehoben. */
  | 'lift'
  /** Eine neue Runde wird ausgeteilt. */
  | 'deal'

export type SoundListener = (sound: SceneSound, strength: number) => void

const listeners = new Set<SoundListener>()

/** Meldet einen Zuhoerer an; der Rueckgabewert meldet ihn wieder ab. */
export function onSceneSound(listener: SoundListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Meldet ein Ereignis.
 *
 * `strength` liegt zwischen 0 und 1 und sagt, wie kraeftig es war -- eine
 * scharf geworfene Karte schlaegt lauter auf als eine hingelegte. Damit kann
 * der Tonteil spaeter Lautstaerke und Tonhoehe streuen, ohne dass die Szene
 * noch einmal angefasst werden muss.
 */
export function emitSceneSound(sound: SceneSound, strength = 0.5): void {
  for (const listener of listeners) listener(sound, strength)
}
