/**
 * Das Kartendeck von Runecall.
 *
 * 52 Zahlenkarten (4 Farben x 1-13), 4 Magier, 4 Narren -- zusammen 60 Karten.
 * Siehe docs/01-REGELWERK.md, Abschnitt 1.
 *
 * Dieses Modul kennt weder DOM noch Netzwerk. Wie eine Karte *aussieht*
 * -- Runensymbol, Farbwert, Illustration -- ist Sache des Clients.
 */

/** Die vier Farben. Untereinander gleichwertig; Trumpf wird je Runde bestimmt. */
export const SUITS = ['red', 'yellow', 'green', 'blue'] as const
export type Suit = (typeof SUITS)[number]

/** Zahlenkarten laufen von 1 bis 13. */
export const PIP_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const
export type PipValue = (typeof PIP_VALUES)[number]

/** Wie viele Magier bzw. Narren im Deck stecken. */
export const MAGES_PER_DECK = 4
export const JESTERS_PER_DECK = 4

/**
 * Jede der 60 Karten hat eine eigene ID.
 *
 * Die 4 Magier sind regeltechnisch gleichwertig, brauchen aber trotzdem
 * unterscheidbare IDs -- fuer Animationen, Log und Kartenzaehlung.
 */
export type CardId = string

export type PipCard = {
  readonly id: CardId
  readonly kind: 'pip'
  readonly suit: Suit
  readonly value: PipValue
}

export type MageCard = {
  readonly id: CardId
  readonly kind: 'mage'
}

export type JesterCard = {
  readonly id: CardId
  readonly kind: 'jester'
}

export type Card = PipCard | MageCard | JesterCard

export const isPip = (card: Card): card is PipCard => card.kind === 'pip'
export const isMage = (card: Card): card is MageCard => card.kind === 'mage'
export const isJester = (card: Card): card is JesterCard => card.kind === 'jester'

/**
 * Baut ein vollstaendiges, ungemischtes Deck in fester Reihenfolge:
 * erst alle Zahlenkarten farbweise aufsteigend, dann Magier, dann Narren.
 *
 * Die feste Reihenfolge ist Absicht -- gemischt wird ausschliesslich ueber
 * den Startwert (siehe rng.ts), damit eine Partie reproduzierbar bleibt.
 */
export function createDeck(): Card[] {
  const deck: Card[] = []

  for (const suit of SUITS) {
    for (const value of PIP_VALUES) {
      deck.push({ id: `${suit}-${value}`, kind: 'pip', suit, value })
    }
  }

  for (let n = 1; n <= MAGES_PER_DECK; n++) {
    deck.push({ id: `mage-${n}`, kind: 'mage' })
  }

  for (let n = 1; n <= JESTERS_PER_DECK; n++) {
    deck.push({ id: `jester-${n}`, kind: 'jester' })
  }

  return deck
}

/** Gesamtzahl der Karten im Deck. Basis fuer die Rundenzahl je Spielerzahl. */
export const DECK_SIZE = SUITS.length * PIP_VALUES.length + MAGES_PER_DECK + JESTERS_PER_DECK
