/**
 * Der Ablauf einer Partie Runecall.
 *
 * Aufbau: ein Zustand plus eine Funktion, die aus Zustand und Aktion den
 * naechsten Zustand macht. Kein Timer, keine Warterei, kein Zufall ausser
 * ueber den Startwert -- die Engine kennt nur Zuege.
 *
 * Damit laeuft derselbe Code an drei Stellen (docs/04-TECHNIK-EMPFEHLUNG.md):
 * in den Tests, im Server als Wahrheit ueber die Partie, und im Client als
 * Bequemlichkeit fuer den Spieler. Der Server prueft jeden Zug selbst; die
 * Pruefung im Client ist Komfort, keine Absicherung.
 *
 * Wer wann was darf, steht in docs/01-REGELWERK.md, Abschnitte 3 bis 7.
 */

import { SUITS, createDeck, type Card, type CardId, type Suit } from './cards.ts'
import { createRng, shuffle } from './rng.ts'
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  legalPlays,
  playViolation,
  roundCount,
  roundScore,
  trickWinner,
  winnersOf,
  type Play,
  type WinReason,
} from './rules.ts'

/* ------------------------------------------------------------------ *
 * Fehler
 * ------------------------------------------------------------------ */

/**
 * Ein abgelehnter Zug. `code` ist maschinenlesbar, `message` erklaert den
 * Fall fuer Log und Fehlersuche -- nicht fuer die Oberflaeche.
 */
export class RuleError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'RuleError'
    this.code = code
  }
}

/* ------------------------------------------------------------------ *
 * Zustand
 * ------------------------------------------------------------------ */

export type Phase =
  /** Ein Magier liegt offen, der Geber waehlt die Trumpffarbe (Regelwerk 4.2). */
  | 'trump-choice'
  /** Reihum ansagen, beginnend links vom Geber. */
  | 'bidding'
  /** Stiche werden ausgespielt. */
  | 'playing'
  /** Runde gewertet, Punkte stehen. Wartet auf `next-round`. */
  | 'round-end'
  /** Alle Runden gespielt. */
  | 'game-over'

/** Ein abgeschlossener Stich -- bleibt sichtbar, bis der naechste beginnt. */
export type CompletedTrick = {
  readonly plays: readonly Play[]
  readonly winner: number
  readonly reason: WinReason
}

/**
 * Was in einer Partie passiert ist. Der Client haengt daran seine
 * Animationen, die Textausgabe ihre Zeilen, und beim Nachstellen eines
 * Fehlers liest man hier nach, was schiefging.
 */
export type GameEvent =
  | { readonly type: 'round-dealt'; readonly round: number; readonly dealer: number }
  | { readonly type: 'trump-revealed'; readonly card: Card | null; readonly suit: Suit | null }
  | { readonly type: 'trump-chosen'; readonly player: number; readonly suit: Suit }
  | { readonly type: 'bid'; readonly player: number; readonly value: number }
  | { readonly type: 'card-played'; readonly player: number; readonly card: Card }
  | {
      readonly type: 'trick-won'
      readonly plays: readonly Play[]
      readonly winner: number
      readonly reason: WinReason
    }
  | {
      readonly type: 'round-scored'
      readonly round: number
      readonly points: readonly number[]
      readonly totals: readonly number[]
    }
  | { readonly type: 'game-over'; readonly winners: readonly number[] }

export type GameState = {
  readonly playerCount: number
  readonly seed: number
  readonly totalRounds: number
  readonly roundNumber: number
  readonly dealer: number
  readonly phase: Phase

  /** Handkarten je Sitzplatz, in Austeilreihenfolge. Geheim. */
  readonly hands: readonly (readonly Card[])[]
  /** Reststapel. Geheim -- bis auf die oberste Karte, den Trumpf. */
  readonly stock: readonly Card[]
  /** Alle in dieser Runde bereits gelegten Karten. Oeffentlich (Frage 15). */
  readonly playedCards: readonly Card[]

  readonly trumpCard: Card | null
  readonly trumpSuit: Suit | null

  /** Ansage je Sitzplatz, `null` solange noch nicht angesagt. */
  readonly bids: readonly (number | null)[]
  readonly tricksWon: readonly number[]
  /** Gesamtpunkte ueber die ganze Partie. */
  readonly scores: readonly number[]

  readonly trickNumber: number
  readonly currentTrick: readonly Play[]
  readonly lastTrick: CompletedTrick | null
  readonly leader: number
  readonly turn: number

  readonly events: readonly GameEvent[]
}

export type Action =
  | { readonly type: 'choose-trump'; readonly suit: Suit }
  | { readonly type: 'bid'; readonly value: number }
  | { readonly type: 'play'; readonly cardId: CardId }
  | { readonly type: 'next-round' }

/* ------------------------------------------------------------------ *
 * Partie beginnen
 * ------------------------------------------------------------------ */

export type GameOptions = {
  readonly playerCount: number
  /**
   * Startwert der Kartenverteilung. Absichtlich verpflichtend: die Engine
   * wuerfelt nicht selbst. Bei Online-Partien vergibt ihn der Server.
   */
  readonly seed: number
  /** Wer die erste Runde gibt. Standard: Sitzplatz 0. */
  readonly dealer?: number
  /**
   * Wie viele Runden gespielt werden. Standard: so viele, wie das Deck
   * hergibt (Regelwerk 2).
   *
   * Kuerzer geht immer: Eine Partie ueber acht statt fuenfzehn Runden ist
   * dieselbe Partie, sie hoert nur frueher auf. Gebraucht wird das an zwei
   * Stellen -- im eigenen Raum, wo die Laenge frei einstellbar ist, und im
   * Matchmaking, wo sie feststeht (Entscheidungen 4 und 4b).
   */
  readonly totalRounds?: number
}

export function createGame(options: GameOptions): GameState {
  const { playerCount, seed } = options

  if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new RuleError(
      'player-count',
      `Runecall wird zu ${MIN_PLAYERS} bis ${MAX_PLAYERS} gespielt, nicht zu ${playerCount}`,
    )
  }

  const dealer = options.dealer ?? 0
  if (!Number.isInteger(dealer) || dealer < 0 || dealer >= playerCount) {
    throw new RuleError('dealer', `Sitzplatz ${dealer} gibt es bei ${playerCount} Spielern nicht`)
  }

  const maxRounds = roundCount(playerCount)
  const totalRounds = options.totalRounds ?? maxRounds
  if (!Number.isInteger(totalRounds) || totalRounds < 1 || totalRounds > maxRounds) {
    throw new RuleError(
      'total-rounds',
      `Zu ${playerCount} Spielern sind 1 bis ${maxRounds} Runden moeglich, nicht ${totalRounds}`,
    )
  }

  const empty: GameState = {
    playerCount,
    seed,
    totalRounds,
    roundNumber: 0,
    dealer,
    phase: 'round-end',
    hands: [],
    stock: [],
    playedCards: [],
    trumpCard: null,
    trumpSuit: null,
    bids: [],
    tricksWon: [],
    scores: Array.from({ length: playerCount }, () => 0),
    trickNumber: 0,
    currentTrick: [],
    lastTrick: null,
    leader: dealer,
    turn: dealer,
    events: [],
  }

  return startRound(empty, 1, dealer)
}

/**
 * Eigener Startwert je Runde, abgeleitet aus Partie-Startwert und
 * Rundennummer. So bleibt jede Runde einzeln nachstellbar, ohne dass der
 * Zustand des Zufallsgenerators mitgeschleppt und mitgesendet werden muss.
 */
function dealSeed(seed: number, round: number): number {
  let mixed = (seed ^ Math.imul(round, 0x9e3779b1)) >>> 0
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x85ebca6b) >>> 0
  return mixed >>> 0
}

/** Geben, Trumpf aufdecken, Ansagen vorbereiten (Regelwerk 3 und 4). */
function startRound(state: GameState, roundNumber: number, dealer: number): GameState {
  const { playerCount } = state
  const deck = shuffle(createDeck(), createRng(dealSeed(state.seed, roundNumber)))

  // Reihum geben, wie am Tisch: der Spieler links vom Geber bekommt zuerst.
  const hands: Card[][] = Array.from({ length: playerCount }, () => [])
  let index = 0

  for (let pass = 0; pass < roundNumber; pass++) {
    for (let step = 1; step <= playerCount; step++) {
      const card = deck[index]
      const hand = hands[(dealer + step) % playerCount]
      if (card === undefined || hand === undefined) {
        throw new RuleError('deal', `Das Deck reicht fuer Runde ${roundNumber} nicht aus`)
      }
      hand.push(card)
      index++
    }
  }

  const stock = deck.slice(index)
  const trumpCard = stock[0] ?? null
  const leader = (dealer + 1) % playerCount

  // Trumpfbestimmung (Regelwerk 4). Kein Reststapel heisst letzte Runde und
  // damit kein Trumpf; ein aufgedeckter Narr ebenfalls.
  let trumpSuit: Suit | null = null
  let phase: Phase = 'bidding'

  if (trumpCard !== null) {
    if (trumpCard.kind === 'pip') {
      trumpSuit = trumpCard.suit
    } else if (trumpCard.kind === 'mage') {
      phase = 'trump-choice'
    }
  }

  return {
    ...state,
    roundNumber,
    dealer,
    phase,
    hands,
    stock,
    playedCards: [],
    trumpCard,
    trumpSuit,
    bids: Array.from({ length: playerCount }, () => null),
    tricksWon: Array.from({ length: playerCount }, () => 0),
    trickNumber: 1,
    currentTrick: [],
    lastTrick: null,
    leader,
    turn: phase === 'trump-choice' ? dealer : leader,
    events: [
      ...state.events,
      { type: 'round-dealt', round: roundNumber, dealer },
      { type: 'trump-revealed', card: trumpCard, suit: trumpSuit },
    ],
  }
}

/* ------------------------------------------------------------------ *
 * Zuege
 * ------------------------------------------------------------------ */

export function applyAction(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'choose-trump':
      return chooseTrump(state, action.suit)
    case 'bid':
      return placeBid(state, action.value)
    case 'play':
      return playCard(state, action.cardId)
    case 'next-round':
      return nextRound(state)
  }
}

function requirePhase(state: GameState, expected: Phase): void {
  if (state.phase !== expected) {
    throw new RuleError('phase', `Erwartet wurde die Phase ${expected}, die Partie steht auf ${state.phase}`)
  }
}

/** Trumpfwahl nach aufgedecktem Magier -- immer durch den Geber (4.2). */
function chooseTrump(state: GameState, suit: Suit): GameState {
  requirePhase(state, 'trump-choice')

  if (!SUITS.includes(suit)) {
    throw new RuleError('suit', `${suit} ist keine der vier Farben`)
  }

  return {
    ...state,
    trumpSuit: suit,
    phase: 'bidding',
    turn: state.leader,
    events: [...state.events, { type: 'trump-chosen', player: state.dealer, suit }],
  }
}

/**
 * Ansage (Regelwerk 5). Erlaubt ist 0 bis Rundennummer. Die Summe muss
 * nicht aufgehen -- die Geber-Einschraenkung ist bewusst aus.
 */
function placeBid(state: GameState, value: number): GameState {
  requirePhase(state, 'bidding')

  if (!Number.isInteger(value) || value < 0 || value > state.roundNumber) {
    throw new RuleError('bid-range', `Ansage ${value} liegt nicht zwischen 0 und ${state.roundNumber}`)
  }

  const player = state.turn
  const bids = state.bids.map((bid, seat) => (seat === player ? value : bid))
  const complete = bids.every((bid) => bid !== null)

  return {
    ...state,
    bids,
    phase: complete ? 'playing' : 'bidding',
    turn: complete ? state.leader : (player + 1) % state.playerCount,
    events: [...state.events, { type: 'bid', player, value }],
  }
}

/** Eine Karte legen (Regelwerk 6). Ist der Stich damit voll, wird er sofort ausgewertet. */
function playCard(state: GameState, cardId: CardId): GameState {
  requirePhase(state, 'playing')

  const player = state.turn
  const hand = state.hands[player]
  if (hand === undefined) {
    throw new RuleError('seat', `Sitzplatz ${player} gibt es nicht`)
  }

  const card = hand.find((held) => held.id === cardId)
  if (card === undefined) {
    throw new RuleError('card-not-in-hand', `Karte ${cardId} liegt nicht auf der Hand von Sitzplatz ${player}`)
  }

  const violation = playViolation(card, hand, state.currentTrick)
  if (violation !== null) {
    throw new RuleError(violation.code, `Sitzplatz ${player} muss ${violation.suit} bedienen`)
  }

  const hands = state.hands.map((cards, seat) =>
    seat === player ? cards.filter((held) => held.id !== cardId) : cards,
  )
  const currentTrick: Play[] = [...state.currentTrick, { player, card }]
  const events: GameEvent[] = [...state.events, { type: 'card-played', player, card }]
  const playedCards = [...state.playedCards, card]

  // Der Stich ist noch nicht voll -- der naechste Spieler ist dran.
  if (currentTrick.length < state.playerCount) {
    return {
      ...state,
      hands,
      currentTrick,
      playedCards,
      turn: (player + 1) % state.playerCount,
      events,
    }
  }

  // Stich vollstaendig: auswerten (6.3). Ab hier nimmt die Engine keinen Zug
  // mehr fuer diesen Stich an -- er ist entschieden, bevor irgendeine
  // Oberflaeche ihn anzeigt.
  const result = trickWinner(currentTrick, state.trumpSuit)
  const tricksWon = state.tricksWon.map((won, seat) => (seat === result.winner ? won + 1 : won))
  const lastTrick: CompletedTrick = {
    plays: currentTrick,
    winner: result.winner,
    reason: result.reason,
  }
  events.push({
    type: 'trick-won',
    plays: currentTrick,
    winner: result.winner,
    reason: result.reason,
  })

  const roundOver = state.trickNumber >= state.roundNumber

  if (!roundOver) {
    return {
      ...state,
      hands,
      playedCards,
      tricksWon,
      trickNumber: state.trickNumber + 1,
      currentTrick: [],
      lastTrick,
      leader: result.winner,
      turn: result.winner,
      events,
    }
  }

  return finishRound({ ...state, hands, playedCards, tricksWon, currentTrick: [], lastTrick, events })
}

/** Wertung am Rundenende (Regelwerk 7). */
function finishRound(state: GameState): GameState {
  const bids = state.bids.map((bid, seat) => {
    if (bid === null) {
      throw new RuleError('internal', `Sitzplatz ${seat} hat nie angesagt, die Runde kann nicht gewertet werden`)
    }
    return bid
  })

  const points = bids.map((bid, seat) => roundScore(bid, state.tricksWon[seat] ?? 0))
  const totals = state.scores.map((total, seat) => total + (points[seat] ?? 0))

  return {
    ...state,
    phase: 'round-end',
    scores: totals,
    events: [
      ...state.events,
      { type: 'round-scored', round: state.roundNumber, points, totals },
    ],
  }
}

/** Naechste Runde geben -- oder die Partie beenden. Der Geber rueckt einen Platz weiter. */
function nextRound(state: GameState): GameState {
  requirePhase(state, 'round-end')

  if (state.roundNumber >= state.totalRounds) {
    const winners = winnersOf(state.scores)
    return {
      ...state,
      phase: 'game-over',
      events: [...state.events, { type: 'game-over', winners }],
    }
  }

  return startRound(state, state.roundNumber + 1, (state.dealer + 1) % state.playerCount)
}

/* ------------------------------------------------------------------ *
 * Sicht eines einzelnen Spielers
 * ------------------------------------------------------------------ */

/**
 * Was ein Spieler wissen darf.
 *
 * Runecall ist ein Spiel mit verdeckten Informationen. Ein Client, der alle
 * Haende kennt, ist ein Client, mit dem man perfekt spielt -- deshalb
 * schickt der Server nie den vollen Zustand, sondern nur diese Sicht.
 * Der Reststapel bleibt bis auf die Trumpfkarte verborgen.
 */
export type PlayerView = {
  readonly you: number
  readonly hand: readonly Card[]
  /** Wie viele Karten die anderen noch halten -- nicht welche. */
  readonly handSizes: readonly number[]
  /** IDs der Karten, die dieser Spieler gerade legen darf. Leer, wenn er nicht dran ist. */
  readonly playable: readonly CardId[]

  readonly phase: Phase
  readonly roundNumber: number
  readonly totalRounds: number
  readonly dealer: number
  readonly leader: number
  readonly turn: number
  readonly trickNumber: number

  readonly trumpCard: Card | null
  readonly trumpSuit: Suit | null
  readonly bids: readonly (number | null)[]
  readonly tricksWon: readonly number[]
  readonly scores: readonly number[]

  readonly currentTrick: readonly Play[]
  readonly lastTrick: CompletedTrick | null
  readonly playedCards: readonly Card[]
  readonly stockSize: number
}

export function playerView(state: GameState, player: number): PlayerView {
  const hand = state.hands[player]
  if (hand === undefined) {
    throw new RuleError('seat', `Sitzplatz ${player} gibt es nicht`)
  }

  const onTurn = state.phase === 'playing' && state.turn === player
  const playable = onTurn ? legalPlays(hand, state.currentTrick).map((card) => card.id) : []

  return {
    you: player,
    hand,
    handSizes: state.hands.map((cards) => cards.length),
    playable,
    phase: state.phase,
    roundNumber: state.roundNumber,
    totalRounds: state.totalRounds,
    dealer: state.dealer,
    leader: state.leader,
    turn: state.turn,
    trickNumber: state.trickNumber,
    trumpCard: state.trumpCard,
    trumpSuit: state.trumpSuit,
    bids: state.bids,
    tricksWon: state.tricksWon,
    scores: state.scores,
    currentTrick: state.currentTrick,
    lastTrick: state.lastTrick,
    playedCards: state.playedCards,
    stockSize: state.stock.length,
  }
}
