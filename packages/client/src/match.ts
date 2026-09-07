/**
 * Was eine Partie ausmacht, bevor sie beginnt.
 *
 * Zwei Wege fuehren an den Tisch, und sie unterscheiden sich nicht in den
 * Regeln, sondern darin, wer sie festlegt (Entscheidung 4 und die
 * Lobby-Trennung in docs/00-ENTSCHEIDUNGEN.md):
 *
 * - **Ranked** -- fester Regelsatz, nichts einstellbar. Vier Spieler, acht
 *   Runden, jedes Mal. Nur so sind zwei Partien vergleichbar, und nur
 *   vergleichbare Partien darf man mit Rangpunkten bewerten.
 * - **Freunde** -- ein Raum mit Code, in dem der Ersteller alles bestimmt.
 *   Dafuer zaehlt dort nichts fuer den Rang.
 *
 * Dieser Bauplan geht in die Sitzung und in den Spielstand. Sobald der Server
 * steht, kommt er von dort statt von hier -- die Form bleibt dieselbe.
 */

import { roundCount } from '@runecall/engine'
import type { Difficulty } from '@runecall/bots'

export type MatchMode = 'ranked' | 'friends'

export type MatchConfig = {
  readonly mode: MatchMode
  readonly playerCount: number
  readonly totalRounds: number
  /** Stufe der Bots, die freie Plaetze besetzen (Entscheidung 2.5). */
  readonly difficulty: Difficulty
  /** Der Code des Raums. Im Matchmaking gibt es keinen. */
  readonly roomCode: string | null
}

/* ------------------------------------------------------------------ *
 * Ranked
 * ------------------------------------------------------------------ */

/** Vier Spieler, acht Runden -- der Regelsatz der gewerteten Partie. */
export const RANKED_PLAYERS = 4
export const RANKED_ROUNDS = 8

/**
 * Die Stufe der Bots, die in einer gewerteten Partie einspringen.
 *
 * Bewusst die hoechste: Wer Rangpunkte gewinnt, soll sie nicht davon
 * bekommen, dass zufaellig niemand sonst gesucht hat. Ein leichter Ersatz
 * waere ein Geschenk an den, der zur richtigen Zeit auf "Spielersuche"
 * drueckt.
 */
export const RANKED_DIFFICULTY: Difficulty = 'hard'

export function rankedMatch(): MatchConfig {
  return {
    mode: 'ranked',
    playerCount: RANKED_PLAYERS,
    totalRounds: RANKED_ROUNDS,
    difficulty: RANKED_DIFFICULTY,
    roomCode: null,
  }
}

/* ------------------------------------------------------------------ *
 * Eigener Raum
 * ------------------------------------------------------------------ */

export type FriendsOptions = {
  readonly playerCount: number
  readonly difficulty: Difficulty
  /** Gewuenschte Rundenzahl; `null` heisst: so viele, wie das Deck hergibt. */
  readonly rounds: number | null
  readonly roomCode: string
}

export function friendsMatch(options: FriendsOptions): MatchConfig {
  return {
    mode: 'friends',
    playerCount: options.playerCount,
    totalRounds: clampRounds(options.rounds, options.playerCount),
    difficulty: options.difficulty,
    roomCode: options.roomCode,
  }
}

/**
 * Haelt die Rundenzahl in dem, was das Deck bei dieser Spielerzahl hergibt.
 *
 * Noetig, weil beides getrennt eingestellt wird: Wer zehn Runden waehlt und
 * danach auf sechs Spieler geht, haette sonst eine Partie verlangt, die die
 * Engine gar nicht austeilen kann (bei sechs Spielern sind zehn das Maximum).
 */
export function clampRounds(rounds: number | null, playerCount: number): number {
  const max = roundCount(playerCount)
  if (rounds === null) return max
  return Math.max(1, Math.min(max, Math.round(rounds)))
}

/* ------------------------------------------------------------------ *
 * Raumcode
 * ------------------------------------------------------------------ */

/**
 * Das Alphabet der Raumcodes -- ohne die Zeichen, die man verwechselt.
 *
 * Ein Code wird vorgelesen oder abgetippt, nicht angeklickt. O und 0, I und
 * 1, S und 5 kosten in dem Moment mehr, als die zusaetzlichen Zeichen an
 * Kombinationen bringen. Was bleibt, ergibt bei fuenf Stellen immer noch gut
 * 20 Millionen Codes.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789'
export const ROOM_CODE_LENGTH = 5

export function createRoomCode(): string {
  const draw = new Uint32Array(ROOM_CODE_LENGTH)
  crypto.getRandomValues(draw)

  let code = ''
  for (const value of draw) code += CODE_ALPHABET[value % CODE_ALPHABET.length]
  return code
}

/** Macht aus einer Eingabe einen Code: Grossbuchstaben, nichts Fremdes drin. */
export function normalizeRoomCode(text: string): string {
  return [...text.toUpperCase()]
    .filter((sign) => CODE_ALPHABET.includes(sign))
    .slice(0, ROOM_CODE_LENGTH)
    .join('')
}

export function isRoomCode(text: string): boolean {
  return normalizeRoomCode(text).length === ROOM_CODE_LENGTH
}
