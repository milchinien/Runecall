/**
 * Runecall -- Regel-Engine.
 *
 * Laeuft an drei Stellen: in den Tests, im Server und im Client. Deshalb
 * kennt dieses Paket weder DOM noch Netzwerk und ist vollstaendig
 * deterministisch.
 *
 * Stand: Kartendeck und Zufall. Rundenablauf, Stichauswertung, Ansagen und
 * Wertung folgen als naechstes (docs/01-REGELWERK.md).
 */

export {
  SUITS,
  PIP_VALUES,
  MAGES_PER_DECK,
  JESTERS_PER_DECK,
  DECK_SIZE,
  createDeck,
  isPip,
  isMage,
  isJester,
} from './cards.ts'

export type { Suit, PipValue, CardId, Card, PipCard, MageCard, JesterCard } from './cards.ts'

export { createRng, shuffle } from './rng.ts'
export type { Rng } from './rng.ts'
