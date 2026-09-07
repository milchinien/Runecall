/**
 * Rangpunkte -- die Wertung der gewerteten Partie.
 *
 * Bewusst einfach: Ein Platz am Ende der Partie, eine Zahl dafuer. Kein
 * verstecktes Koennensmass, keine Serienboni.
 *
 *   1. Platz  +5      3. Platz  -1
 *   2. Platz  +2      4. Platz  -4
 *
 * Die Summe ueber alle vier Plaetze ist +2 und damit leicht positiv: Wer
 * spielt und mittelmaessig abschneidet, steigt langsam; wer dauernd hinten
 * landet, faellt. Das ist Absicht -- eine Wertung, die im Schnitt nur
 * abzieht, bestraft das Spielen selbst.
 *
 * Gewertet wird ausschliesslich, was ueber die Spielersuche zustande kam
 * (`mode: 'ranked'`). Im eigenen Raum bestimmt der Ersteller die Regeln, und
 * was man sich selbst zurechtlegt, kann man nicht gegeneinander messen.
 */

import { readStore, writeStore } from './store.ts'

/** Punkte nach Platz, beginnend beim ersten. */
export const RANK_POINTS: readonly number[] = [5, 2, -1, -4]

export type RankState = {
  readonly points: number
  readonly games: number
  readonly wins: number
}

export const EMPTY_RANK: RankState = { points: 0, games: 0, wins: 0 }

/**
 * Der Platz eines Spielers am Partieende.
 *
 * Gleichstand teilt den Platz: Zwei Erste sind beide Erste, der Naechste ist
 * Dritter. Das passt zu Entscheidung 11 (geteilter Sieg) -- wer punktgleich
 * vorn liegt, hat auch punktgleich gewonnen.
 */
export function placementOf(scores: readonly number[], seat: number): number {
  const mine = scores[seat] ?? 0
  return 1 + scores.filter((score) => score > mine).length
}

/**
 * Was ein Platz bringt. Plaetze jenseits der Tabelle -- die es beim festen
 * Vierer-Regelsatz nicht gibt -- zaehlen wie der letzte.
 */
export function rankPointsFor(place: number): number {
  return RANK_POINTS[place - 1] ?? RANK_POINTS[RANK_POINTS.length - 1] ?? 0
}

/* ------------------------------------------------------------------ *
 * Raenge
 * ------------------------------------------------------------------ */

/**
 * Fuenf Stufen, damit die Punktzahl etwas heisst.
 *
 * Eine nackte Zahl sagt nur im Vergleich mit anderen etwas, und es gibt noch
 * keine anderen -- der Server kommt spaeter. Bis dahin ist die Stufe das
 * Ziel: Sie ist erreichbar und bleibt erreicht.
 */
export const RANK_TIERS: readonly { readonly from: number; readonly name: string }[] = [
  { from: 0, name: 'Funke' },
  { from: 25, name: 'Rune' },
  { from: 60, name: 'Siegel' },
  { from: 110, name: 'Zirkel' },
  { from: 180, name: 'Erzmagier' },
]

export function tierOf(points: number): string {
  let name = RANK_TIERS[0]?.name ?? ''
  for (const tier of RANK_TIERS) if (points >= tier.from) name = tier.name
  return name
}

/** Die naechste Stufe, oder `null` auf der hoechsten. */
export function nextTier(points: number): { readonly from: number; readonly name: string } | null {
  return RANK_TIERS.find((tier) => tier.from > points) ?? null
}

/* ------------------------------------------------------------------ *
 * Speicher
 * ------------------------------------------------------------------ */

const RANK_KEY = 'runecall.rank.v1'

export function loadRank(): RankState {
  const raw = readStore(RANK_KEY)
  if (raw === null || typeof raw !== 'object') return EMPTY_RANK

  const saved = raw as Partial<RankState>
  return {
    points: whole(saved.points),
    games: whole(saved.games),
    wins: whole(saved.wins),
  }
}

export function saveRank(rank: RankState): void {
  writeStore(RANK_KEY, rank)
}

export type RankResult = {
  readonly place: number
  /** Was tatsaechlich verbucht wurde -- an der Null kann es weniger sein. */
  readonly delta: number
  readonly rank: RankState
}

/**
 * Verbucht eine beendete gewertete Partie.
 *
 * Unter null geht es nicht. Ein Minusstand waere keine Auskunft mehr,
 * sondern eine Strafe, die man vor sich herschiebt; die Null ist der Boden,
 * von dem aus es wieder aufwaerts geht. Zurueckgemeldet wird deshalb die
 * Aenderung, die wirklich stattgefunden hat, und nicht die aus der Tabelle --
 * sonst stuende auf der Wertungstafel "-4", wo nur -1 abgezogen wurde.
 */
export function recordRankedResult(place: number): RankResult {
  const before = loadRank()
  const points = Math.max(0, before.points + rankPointsFor(place))

  const rank: RankState = {
    points,
    games: before.games + 1,
    wins: before.wins + (place === 1 ? 1 : 0),
  }

  saveRank(rank)
  return { place, delta: points - before.points, rank }
}

function whole(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}
