/**
 * Runecall -- Computergegner in drei Stufen (Entscheidung 3).
 *
 * - **Leicht** wirft zufaellig eine erlaubte Karte. Sagt ungefaehr an, was
 *   die Hand hergibt, spielt danach aber ohne Plan. Zum Reinkommen.
 * - **Normal** rechnet mit, was er noch braucht, und spielt entsprechend auf
 *   Stich oder auf Verlust. Kennt Trumpf und Bedienpflicht, zaehlt aber nicht.
 * - **Schwer** zaehlt zusaetzlich die Karten: er weiss, welche hoeheren
 *   Karten noch im Spiel sind, und erkennt, wann eine Karte nicht mehr zu
 *   schlagen ist.
 *
 * Alle drei bekommen nur `PlayerView` zu sehen -- ihre eigene Hand plus das,
 * was oeffentlich ist. Derselbe Bot kann deshalb spaeter im Server einen
 * leeren oder getrennten Platz uebernehmen, ohne dass sich etwas aendert.
 */

import {
  SUITS,
  createRng,
  isPip,
  legalPlays,
  trickWinner,
  type Card,
  type CardId,
  type PlayerView,
  type Rng,
  type Suit,
} from '@runecall/engine'

import { isBoss, readTable } from './knowledge.ts'

export { readTable, threatsAgainst, isBoss, couldBeat } from './knowledge.ts'
export type { Knowledge } from './knowledge.ts'

export type Difficulty = 'easy' | 'normal' | 'hard'

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard']

export type Bot = {
  readonly difficulty: Difficulty
  /** Nur relevant, wenn dieser Bot Geber ist und ein Magier aufgedeckt wurde. */
  chooseTrump(view: PlayerView): Suit
  chooseBid(view: PlayerView): number
  chooseCard(view: PlayerView): CardId
}

/**
 * Erzeugt einen Bot. Der Startwert steuert nur die Zufallsanteile -- bei
 * gleichem Startwert spielt derselbe Bot dieselbe Partie gleich.
 */
export function createBot(difficulty: Difficulty, seed: number): Bot {
  const rng = createRng(seed)

  return {
    difficulty,
    chooseTrump: (view) => chooseTrump(view),
    chooseBid: (view) => chooseBid(view, difficulty, rng),
    chooseCard: (view) => chooseCard(view, difficulty, rng),
  }
}

/* ------------------------------------------------------------------ *
 * Einschaetzung einer einzelnen Karte
 * ------------------------------------------------------------------ */

/**
 * Wie wahrscheinlich diese Karte fuer sich genommen einen Stich holt.
 *
 * Bewusst grob: die Zahlen sind an Erfahrungswerten geschaetzt, nicht
 * ausgerechnet. Sie muessen nur die richtige Reihenfolge herstellen -- ein
 * hoher Trumpf vor einer hohen Farbkarte, ein Narr ganz hinten.
 */
export function winChance(card: Card, trump: Suit | null, playerCount: number): number {
  if (card.kind === 'mage') return 0.95
  if (card.kind === 'jester') return 0.02

  if (trump !== null && card.suit === trump) {
    return Math.min(0.92, 0.22 + 0.06 * card.value)
  }

  // Eine Farbkarte gewinnt nur, wenn niemand sie ueberbietet und niemand
  // stechen kann. Mit jedem Mitspieler wird das unwahrscheinlicher.
  const high = Math.max(0, (card.value - 8) / 6)
  return high * Math.pow(0.85, playerCount - 3)
}

/** Summe der Einzelchancen -- die Rohschaetzung fuer die Ansage. */
export function estimateTricks(view: PlayerView): number {
  return view.hand.reduce(
    (sum, card) => sum + winChance(card, view.trumpSuit, view.handSizes.length),
    0,
  )
}

/* ------------------------------------------------------------------ *
 * Trumpfwahl
 * ------------------------------------------------------------------ */

/** Die eigene laengste und hoechste Farbe. Gilt fuer alle Stufen gleich. */
function chooseTrump(view: PlayerView): Suit {
  let best: Suit = SUITS[0] ?? 'red'
  let bestWeight = -1

  for (const suit of SUITS) {
    let weight = 0
    for (const card of view.hand) {
      if (isPip(card) && card.suit === suit) weight += card.value >= 10 ? 2 : 1
    }
    if (weight > bestWeight) {
      best = suit
      bestWeight = weight
    }
  }

  return best
}

/* ------------------------------------------------------------------ *
 * Ansage
 * ------------------------------------------------------------------ */

function chooseBid(view: PlayerView, difficulty: Difficulty, rng: Rng): number {
  let estimate = estimateTricks(view)

  if (difficulty === 'easy') {
    // Grobe Richtung, aber mit Streuung -- daher auch die vielen Fehlgriffe.
    estimate += rng.next() - 0.5
  }

  if (difficulty === 'hard') {
    // Haben die anderen zusammen schon mehr angesagt, als es Stiche gibt,
    // wird es eng: dann lieber eine Spur vorsichtiger.
    const placed = view.bids.reduce<number>((sum, bid) => sum + (bid ?? 0), 0)
    if (placed >= view.roundNumber) estimate -= 0.35
  }

  return clamp(Math.round(estimate), 0, view.roundNumber)
}

/* ------------------------------------------------------------------ *
 * Kartenwahl
 * ------------------------------------------------------------------ */

function chooseCard(view: PlayerView, difficulty: Difficulty, rng: Rng): CardId {
  const legal = legalPlays(view.hand, view.currentTrick)
  const first = legal[0]

  if (first === undefined) {
    throw new Error('Kein erlaubter Zug -- das darf die Engine nicht zulassen')
  }
  if (legal.length === 1) return first.id

  if (difficulty === 'easy') {
    return (legal[rng.nextInt(legal.length)] ?? first).id
  }

  const counting = difficulty === 'hard'
  const rate = (card: Card): number => winChance(card, view.trumpSuit, view.handSizes.length)

  const bid = view.bids[view.you] ?? 0
  const won = view.tricksWon[view.you] ?? 0
  const need = bid - won
  const tricksLeft = view.hand.length

  // Wer alle verbleibenden Stiche braucht, kann nicht mehr ausweichen.
  const wantsTrick = need >= tricksLeft ? true : need > 0

  // Anspiel: es gibt noch nichts zu schlagen, also entscheidet allein die
  // eigene Absicht.
  if (view.currentTrick.length === 0) {
    return (wantsTrick ? strongest(legal, rate) : weakest(legal, rate)).id
  }

  const leading = legal.filter((card) => wouldLead(view, card))
  const losing = legal.filter((card) => !wouldLead(view, card))
  const isLastToPlay = view.currentTrick.length === view.handSizes.length - 1

  if (wantsTrick) {
    // Nicht zu holen -- dann wenigstens billig abwerfen.
    if (leading.length === 0) return weakest(legal, rate).id

    // Als Letzter genuegt die guenstigste Karte, die reicht.
    if (isLastToPlay) return weakest(leading, rate).id

    // Wer zaehlt, erkennt die Karte, die niemand mehr schlagen kann, und
    // gibt dafuer nicht mehr aus als noetig. Der Wissensstand wird einmal
    // gebildet, nicht je gepruefter Karte.
    if (counting) {
      const knowledge = readTable(view)
      const safe = leading.filter((card) => isBoss(knowledge, card))
      const cheapestSafe = safe[0] === undefined ? null : weakest(safe, rate)
      if (cheapestSafe !== null) return cheapestSafe.id
    }

    return strongest(leading, rate).id
  }

  // Der Stich ist nicht gewollt. Eine Karte, die dem aktuell fuehrenden Blatt
  // unterliegt, kann den Stich auch spaeter nicht mehr holen -- deshalb ist
  // die hoechste davon die sicherste Gelegenheit, sie loszuwerden.
  if (losing.length > 0) return strongest(losing, rate).id

  return weakest(leading, rate).id
}

/** Wuerde diese Karte den Stich im Moment anfuehren? */
function wouldLead(view: PlayerView, card: Card): boolean {
  const probe = [...view.currentTrick, { player: view.you, card }]
  return trickWinner(probe, view.trumpSuit).winner === view.you
}

/* ------------------------------------------------------------------ *
 * Kleinkram
 * ------------------------------------------------------------------ */

function strongest(cards: readonly Card[], rate: (card: Card) => number): Card {
  return pickBy(cards, (a, b) => rate(a) >= rate(b))
}

function weakest(cards: readonly Card[], rate: (card: Card) => number): Card {
  return pickBy(cards, (a, b) => rate(a) <= rate(b))
}

function pickBy(cards: readonly Card[], better: (a: Card, b: Card) => boolean): Card {
  const first = cards[0]
  if (first === undefined) throw new Error('Auswahl aus einer leeren Kartenmenge')

  let best = first
  for (const card of cards) {
    if (better(card, best)) best = card
  }
  return best
}

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value))
