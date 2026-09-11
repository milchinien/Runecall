/**
 * Runecall -- die Sprache zwischen Client und Server.
 *
 * Dieses Paket enthaelt absichtlich **nur Typen und Konstanten**, keinen
 * Ablauf. Es ist die einzige Stelle, an der beide Seiten dasselbe wissen
 * muessen; alles andere weiss jede Seite fuer sich.
 *
 * Zwei Regeln, die den Zuschnitt erklaeren:
 *
 * 1. **Der Server schickt nie `GameState`, immer nur `PlayerView`.**
 *    Runecall ist ein Spiel mit verdeckten Informationen -- ein Client, der
 *    alle Haende kennt, ist ein Client, mit dem man perfekt spielt
 *    (docs/00-ENTSCHEIDUNGEN.md, "Der Server muss autoritativ sein").
 * 2. **Der Client schickt nie Zustand, immer nur Absichten.** Ein `action`
 *    ist eine Bitte; ob sie erlaubt war, entscheidet der Server mit derselben
 *    Engine, die auch in den Tests laeuft.
 */

import type { Action, PlayerView } from '@runecall/engine'
import type { Difficulty } from '@runecall/bots'

/* ------------------------------------------------------------------ *
 * Raumcodes
 * ------------------------------------------------------------------ */

/**
 * Das Alphabet der Raumcodes.
 *
 * Ohne I, O, 0 und 1: Ein Code wird durchgesagt oder abgetippt, und genau
 * diese vier verwechselt man dabei.
 */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 5

/* ------------------------------------------------------------------ *
 * Der Raum
 * ------------------------------------------------------------------ */

/** Worauf sich der Raum geeinigt hat. Nur der Wirt darf das aendern. */
export type RoomRules = {
  readonly playerCount: number
  /** `null` heisst: so viele Runden, wie das Deck hergibt. */
  readonly rounds: number | null
  /** Stufe der Bots, die freie Plaetze besetzen (Entscheidung 2.5). */
  readonly difficulty: Difficulty
}

/** Wer auf einem Platz sitzt -- aus der Sicht aller, also ohne Karten. */
export type Occupant =
  | { readonly kind: 'human'; readonly name: string; readonly connected: boolean }
  | { readonly kind: 'bot'; readonly name: string }
  | { readonly kind: 'empty' }

/**
 * Der oeffentliche Stand des Raums.
 *
 * Geht an alle im Raum und enthaelt deshalb nichts, was nicht alle sehen
 * duerfen.
 */
export type Lobby = {
  readonly code: string
  readonly rules: RoomRules
  /** Wer die Regeln bestimmt und starten darf. */
  readonly hostSeat: number
  readonly seats: readonly Occupant[]
  /** Ob schon gespielt wird. Danach kommt niemand mehr dazu.  */
  readonly started: boolean
}

/* ------------------------------------------------------------------ *
 * Client -> Server
 * ------------------------------------------------------------------ */

export type ClientMessage =
  /**
   * Die erste Nachricht jeder Verbindung.
   *
   * `create` unterscheidet den Wirt vom Gast: Wer einen Raum erstellt, legt
   * ihn an und bringt die Regeln mit. Wer beitritt, nimmt sie, wie sie sind
   * -- und bekommt eine Absage, wenn es den Raum nicht gibt. Das ist der
   * Unterschied zwischen "Raum existiert nicht" und "Raum ist voll", den die
   * Oberflaeche dem Spieler schuldet.
   */
  | {
      readonly type: 'hello'
      readonly name: string
      readonly create: boolean
      readonly rules?: RoomRules
      /**
       * Wer die Seite neu laedt, will auf seinen Platz zurueck und nicht auf
       * einen neuen. Das Merkmal steht im Browser-Speicher und ist nur fuer
       * diesen einen Raum gueltig.
       */
      readonly token?: string
    }
  | { readonly type: 'set-rules'; readonly rules: RoomRules }
  | { readonly type: 'start' }
  | { readonly type: 'action'; readonly action: Action }
  /** Haelt die Verbindung offen, wenn lange niemand zieht. */
  | { readonly type: 'ping' }

/* ------------------------------------------------------------------ *
 * Server -> Client
 * ------------------------------------------------------------------ */

/** Warum jemand nicht in den Raum kommt -- die Oberflaeche macht Text daraus. */
export type RefusalCode =
  | 'no-such-room'
  | 'room-full'
  | 'already-started'
  | 'bad-code'
  | 'bad-name'

export type ServerMessage =
  /** Angekommen. Ab hier weiss der Client, wo er sitzt. */
  | {
      readonly type: 'welcome'
      readonly seat: number
      readonly token: string
      readonly lobby: Lobby
    }
  | { readonly type: 'lobby'; readonly lobby: Lobby }
  /**
   * Ein neuer Stand der Partie -- die eigene Sicht, sonst nichts.
   *
   * Kommt nach jedem Zug, auch nach den eigenen. Der Client zeichnet, was
   * hier steht, und raet nicht selbst weiter.
   */
  | {
      readonly type: 'view'
      readonly view: PlayerView
      readonly names: readonly string[]
      /**
       * Ein Aufsetzpunkt statt eines Schritts.
       *
       * Der Client reiht Sichten auf und spielt sie mit Pausen ab, damit man
       * jede gelegte Karte einzeln sieht. Nach einem Verbindungsabbruch waere
       * das falsch: Dort ist der neue Stand nicht der naechste Schritt,
       * sondern der einzige, der noch gilt -- die Warteschlange gehoert
       * verworfen.
       */
      readonly sync?: boolean
    }
  | { readonly type: 'refused'; readonly reason: RefusalCode }
  /** Ein Zug wurde abgelehnt. Der Client bleibt beim letzten `view`. */
  | { readonly type: 'rejected'; readonly code: string; readonly message: string }
  | { readonly type: 'pong' }
