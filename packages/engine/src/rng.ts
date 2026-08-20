/**
 * Zufall mit festem Startwert.
 *
 * `Math.random()` kommt in der Engine nicht vor. Jede Partie laeuft ueber
 * einen Startwert, damit ein fehlgeschlagener Zufallstest wiederholbar ist
 * und sich ein Fehlerbericht wie "in Runde 7 stimmte die Wertung nicht"
 * nachstellen laesst.
 *
 * Der Startwert ist bewusst *intern*: er wird nirgends in der Oberflaeche
 * angezeigt (Entscheidung 31). Bei Online-Partien vergibt ihn der Server.
 */

export type Rng = {
  /** Naechste Gleitkommazahl in [0, 1). */
  next(): number
  /** Ganzzahl in [0, maxExclusive). */
  nextInt(maxExclusive: number): number
  /** Der Startwert, mit dem dieser Generator erzeugt wurde. */
  readonly seed: number
}

/**
 * mulberry32 -- klein, schnell und fuer Spielzwecke mehr als ausreichend
 * gleichverteilt. Wichtig ist hier nicht kryptografische Guete, sondern dass
 * derselbe Startwert immer dieselbe Folge liefert.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    nextInt: (maxExclusive: number) => Math.floor(next() * maxExclusive),
    seed: seed >>> 0,
  }
}

/**
 * Fisher-Yates. Liefert eine neue Liste; die Eingabe bleibt unveraendert,
 * damit ein einmal gebautes Deck mehrfach verwendbar ist.
 */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = items.slice()

  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1)
    const a = result[i]
    const b = result[j]
    // noUncheckedIndexedAccess: beide Indizes liegen nachweislich im Bereich,
    // die Pruefung ueberzeugt den Compiler ohne Nicht-null-Behauptung.
    if (a !== undefined && b !== undefined) {
      result[i] = b
      result[j] = a
    }
  }

  return result
}
