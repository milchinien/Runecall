/**
 * Runecall -- Regel-Engine.
 *
 * Laeuft an drei Stellen: in den Tests, im Server und im Client. Deshalb
 * kennt dieses Paket weder DOM noch Netzwerk und ist vollstaendig
 * deterministisch.
 *
 * Stand: Kartendeck, Zufall, Regeln und Rundenablauf sind vollstaendig.
 * Als naechstes kommen die Bots (docs/04-TECHNIK-EMPFEHLUNG.md, Schritt 2).
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

export {
  MIN_PLAYERS,
  MAX_PLAYERS,
  roundCount,
  ledSuitOf,
  playViolation,
  isLegalPlay,
  legalPlays,
  trickWinner,
  roundScore,
  winnersOf,
  sortForDisplay,
} from './rules.ts'

export type { Play, LedSuit, PlayViolation, WinReason, TrickResult } from './rules.ts'

export { RuleError, createGame, applyAction, playerView } from './game.ts'

export type {
  Phase,
  GameState,
  GameEvent,
  GameOptions,
  Action,
  CompletedTrick,
  PlayerView,
} from './game.ts'
