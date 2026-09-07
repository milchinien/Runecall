/**
 * Erzeugt einen Spielstand mitten in einer Partie -- fuer die Arbeit an der
 * Tischansicht. Simuliert mit Bots bis zur gewuenschten Runde und haelt an,
 * wenn der Mensch (Platz 0) mitten im Stich am Zug ist.
 *
 * Start:  npx tsx tools/make-save.ts [Spielerzahl] [Startwert] [Runde] [Stichkarten]
 * Ausgabe: JSON im Format des Browserspeichers (runecall.save.v1).
 */

import { applyAction, createGame, playerView } from '../packages/engine/src/index.ts'
import type { GameState } from '../packages/engine/src/index.ts'
import { createBot, type Bot } from '../packages/bots/src/index.ts'

const args = process.argv.slice(2)
const playerCount = Number(args[0] ?? 4)
const seed = Number(args[1] ?? 4711)
const targetRound = Number(args[2] ?? 6)
const trickCards = Number(args[3] ?? 2)

const bots: Bot[] = Array.from({ length: playerCount }, (_, seat) =>
  createBot('normal', seed + seat * 7919),
)

let state: GameState = createGame({ playerCount, seed })
let guard = 0

const atTarget = (): boolean =>
  state.roundNumber === targetRound &&
  state.phase === 'playing' &&
  state.currentTrick.length === trickCards &&
  state.turn === 0

while (!atTarget() && state.phase !== 'game-over') {
  if (guard++ > 10_000) throw new Error('Ziel nicht erreichbar')
  const bot = bots[state.turn]
  if (bot === undefined) throw new Error(`Kein Bot auf Platz ${state.turn}`)
  const view = playerView(state, state.turn)

  switch (state.phase) {
    case 'trump-choice':
      state = applyAction(state, { type: 'choose-trump', suit: bot.chooseTrump(view) })
      break
    case 'bidding':
      state = applyAction(state, { type: 'bid', value: bot.chooseBid(view) })
      break
    case 'playing':
      state = applyAction(state, { type: 'play', cardId: bot.chooseCard(view) })
      break
    case 'round-end':
      state = applyAction(state, { type: 'next-round' })
      break
  }
}

if (!atTarget()) throw new Error('Partie endete vor der Zielrunde')

const save = {
  state,
  settings: { playerCount, difficulty: 'normal', speed: 1000, counting: false, hint: true },
  seed,
}

console.log(JSON.stringify(save))
