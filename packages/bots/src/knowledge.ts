/**
 * Was ein Spieler aus oeffentlicher Information ableiten kann.
 *
 * Ein Bot darf genau das wissen, was ein Mensch am Tisch auch weiss: die
 * eigene Hand, die aufgedeckte Trumpfkarte und alles, was bereits gelegt
 * wurde. Deshalb arbeitet dieses Paket auf `PlayerView` und nie auf dem
 * vollen Spielzustand -- ein Bot mit Blick auf alle Haende waere kein
 * Gegner, sondern ein Betrug.
 *
 * Kartenzaehlen ist damit kein Trick, sondern schlicht Buchhaltung: alle 60
 * Karten sind bekannt, also ist jede noch nicht gesehene Karte eine, die
 * jemand anders halten koennte.
 */

import { createDeck, type Card, type PlayerView, type Suit } from '@runecall/engine'

/** Das Deck einmal gebaut. Es aendert sich nie -- also lohnt sich das Merken. */
const FULL_DECK: readonly Card[] = createDeck()

/**
 * Der Wissensstand eines Spielers zu einem Zeitpunkt.
 *
 * Wird einmal je Entscheidung gebildet, nicht einmal je gepruefter Karte:
 * der schwere Bot vergleicht bis zu zwanzig Karten gegen bis zu sechzig
 * unbekannte, und das darf keine sechzig Deckbauten kosten.
 */
export type Knowledge = {
  /** Karten, die dieser Spieler noch nicht gesehen hat -- fremde Haende oder Reststapel. */
  readonly unseen: readonly Card[]
  readonly trump: Suit | null
}

export function readTable(view: PlayerView): Knowledge {
  const known = new Set<string>()

  for (const card of view.hand) known.add(card.id)
  for (const card of view.playedCards) known.add(card.id)
  if (view.trumpCard !== null) known.add(view.trumpCard.id)

  return {
    unseen: FULL_DECK.filter((card) => !known.has(card.id)),
    trump: view.trumpSuit,
  }
}

/**
 * Koennte `other` die Karte `mine` schlagen, wenn beide im selben Stich
 * liegen?
 *
 * Bewusst ohne Ruecksicht darauf, wer anspielt: fuer die Frage "wie sicher
 * ist meine Karte" zaehlt die schlechteste Annahme, und die lautet, dass der
 * andere seine Karte auch ausspielen darf.
 */
export function couldBeat(other: Card, mine: Card, trump: Suit | null): boolean {
  if (other.kind === 'mage') return true
  if (mine.kind === 'mage') return false
  if (other.kind === 'jester') return false
  if (mine.kind === 'jester') return true

  const otherIsTrump = trump !== null && other.suit === trump
  const mineIsTrump = trump !== null && mine.suit === trump

  if (otherIsTrump !== mineIsTrump) return otherIsTrump
  if (other.suit !== mine.suit) return false

  return other.value > mine.value
}

/** Wie viele unbekannte Karten koennten diese Karte noch schlagen. */
export function threatsAgainst(knowledge: Knowledge, card: Card): number {
  let threats = 0
  for (const other of knowledge.unseen) {
    if (couldBeat(other, card, knowledge.trump)) threats++
  }
  return threats
}

/**
 * Eine Karte, die nach dem heutigen Wissensstand niemand mehr schlagen kann.
 * Der erste Magier ist das immer, ein hoher Trumpf wird es im Lauf der Runde.
 */
export function isBoss(knowledge: Knowledge, card: Card): boolean {
  for (const other of knowledge.unseen) {
    if (couldBeat(other, card, knowledge.trump)) return false
  }
  return true
}
