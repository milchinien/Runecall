/**
 * Der Ablaufsteuerer: verbindet Engine, Bots und Wartezeiten.
 *
 * Die Engine kennt keine Zeit -- sie kennt nur Zuege. Dass ein Bot kurz
 * "nachdenkt" und ein gewonnener Stich einen Moment liegen bleibt, ist eine
 * Frage der Oberflaeche und steht deshalb hier (Fragen 16 und 19).
 *
 * Der Mensch sitzt immer auf Platz 0. Alle anderen Plaetze besetzen Bots,
 * die ausschliesslich ihre eigene Sicht bekommen.
 */

import {
  applyAction,
  createGame,
  playerView,
  type CardId,
  type GameState,
  type PlayerView,
  type Suit,
} from '@runecall/engine'
import { createBot, type Bot } from '@runecall/bots'

import type { MatchConfig } from './match.ts'
import { saveGame, type Settings } from './settings.ts'

/** Der Mensch sitzt immer auf Platz 0. */
export const HUMAN = 0

/** Worauf die Oberflaeche gerade wartet. */
export type Waiting = 'none' | 'bot' | 'trick'

export type Session = {
  readonly settings: Settings
  /** Der Bauplan dieser Partie: Modus, Spielerzahl, Runden, Bot-Stufe. */
  readonly match: MatchConfig
  readonly seed: number
  state(): GameState
  view(): PlayerView
  waiting(): Waiting
  chooseTrump(suit: Suit): void
  bid(value: number): void
  play(cardId: CardId): void
  nextRound(): void
  /** Laufende Wartezeit abkuerzen -- ein Klick ueberspringt sie (Frage 16). */
  skip(): void
  stop(): void
}

export type SessionOptions = {
  readonly settings: Settings
  readonly match: MatchConfig
  readonly seed: number
  /** Fortgesetzte Partie statt neuer. */
  readonly resume?: GameState
}

export function createSession(options: SessionOptions, onChange: () => void): Session {
  const { settings, match, seed } = options

  let state: GameState =
    options.resume ??
    createGame({ playerCount: match.playerCount, totalRounds: match.totalRounds, seed })

  // Alle Plaetze ausser dem eigenen sind Bots -- online spaeter nur die, die
  // frei geblieben oder weggefallen sind (Entscheidungen 2.4 und 2.5). Die
  // Bots selbst aendern sich dadurch nicht, nur wer sie besetzt.
  const bots: Bot[] = Array.from({ length: state.playerCount }, (_, seat) =>
    createBot(match.difficulty, seed + seat * 7919),
  )

  const botAt = (seat: number): Bot => {
    const bot = bots[seat]
    if (bot === undefined) throw new Error(`Kein Bot auf Platz ${seat}`)
    return bot
  }

  /**
   * Wie lange ein gewonnener Stich liegen bleibt, bevor es weitergeht.
   *
   * Etwas laenger als ein einzelner Zug, aber nicht das Doppelte: Beim Stich
   * schaut man auf vier bis sechs Karten, die schon liegen -- man wartet nicht
   * auf etwas, sondern liest nach. Ein Klick kuerzt die Pause ohnehin ab
   * (Frage 16).
   */
  const trickPause = Math.max(700, Math.round(settings.speed * 1.25))

  let timer: number | null = null
  let pending: (() => void) | null = null
  let waiting: Waiting = 'none'
  let seenTrick: GameState['lastTrick'] = null
  let stopped = false

  function schedule(ms: number, run: () => void): void {
    cancel()
    pending = run
    timer = window.setTimeout(() => {
      timer = null
      pending = null
      if (!stopped) run()
    }, ms)
  }

  function cancel(): void {
    if (timer !== null) window.clearTimeout(timer)
    timer = null
    pending = null
  }

  function commit(next: GameState): void {
    state = next
    saveGame({ state, settings, seed, match })
    advance()
  }

  /**
   * Entscheidet, was als Naechstes passiert. Wird nach jedem Zug aufgerufen
   * und ruft sich ueber die Wartezeiten selbst weiter auf, bis der Mensch am
   * Zug ist oder die Partie endet.
   */
  function advance(): void {
    if (stopped) return
    onChange()

    // Ein gewonnener Stich bleibt kurz liegen, bevor der naechste beginnt.
    if (state.lastTrick !== null && state.lastTrick !== seenTrick) {
      waiting = 'trick'
      onChange()
      schedule(trickPause, () => {
        seenTrick = state.lastTrick
        waiting = 'none'
        advance()
      })
      return
    }

    switch (state.phase) {
      case 'trump-choice':
        if (state.dealer === HUMAN) return idle()
        return botTurn(() =>
          applyAction(state, {
            type: 'choose-trump',
            suit: botAt(state.dealer).chooseTrump(playerView(state, state.dealer)),
          }),
        )

      case 'bidding':
        if (state.turn === HUMAN) return idle()
        return botTurn(() =>
          applyAction(state, {
            type: 'bid',
            value: botAt(state.turn).chooseBid(playerView(state, state.turn)),
          }),
        )

      case 'playing':
        if (state.turn === HUMAN) return idle()
        return botTurn(() =>
          applyAction(state, {
            type: 'play',
            cardId: botAt(state.turn).chooseCard(playerView(state, state.turn)),
          }),
        )

      case 'round-end':
      case 'game-over':
        return idle()
    }
  }

  function idle(): void {
    waiting = 'none'
    onChange()
  }

  function botTurn(move: () => GameState): void {
    waiting = 'bot'
    onChange()
    schedule(settings.speed, () => {
      waiting = 'none'
      commit(move())
    })
  }

  // Erste Entscheidung anstossen. Bei einer fortgesetzten Partie gilt der
  // zuletzt gezeigte Stich als gesehen, damit die Pause nicht erneut laeuft.
  seenTrick = state.lastTrick
  queueMicrotask(advance)

  return {
    settings,
    match,
    seed,
    state: () => state,
    view: () => playerView(state, HUMAN),
    waiting: () => waiting,

    chooseTrump(suit) {
      if (state.phase !== 'trump-choice' || state.dealer !== HUMAN) return
      commit(applyAction(state, { type: 'choose-trump', suit }))
    },

    bid(value) {
      if (state.phase !== 'bidding' || state.turn !== HUMAN) return
      commit(applyAction(state, { type: 'bid', value }))
    },

    play(cardId) {
      if (state.phase !== 'playing' || state.turn !== HUMAN) return
      if (waiting !== 'none') return
      commit(applyAction(state, { type: 'play', cardId }))
    },

    nextRound() {
      if (state.phase !== 'round-end') return
      commit(applyAction(state, { type: 'next-round' }))
    },

    skip() {
      const run = pending
      if (run === null) return
      cancel()
      waiting = 'none'
      run()
    },

    stop() {
      stopped = true
      cancel()
    },
  }
}
