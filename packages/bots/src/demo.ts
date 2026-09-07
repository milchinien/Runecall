/**
 * Eine ganze Partie als Text im Terminal -- gespielt von echten Bots.
 *
 * Damit laesst sich pruefen, ob Regeln und Gegner stimmen, ohne dass eine
 * Grafik im Weg steht (Frage 2.18). Jede Zeile ist nachlesbar: wer hat was
 * gelegt, warum hat dieser Stich gewonnen, wie kommt die Wertung zustande.
 *
 * Start:  npm run demo
 *         npm run demo -- 6 4711 hard      (Spielerzahl, Startwert, Stufe)
 *
 * Der Textlauf liegt hier und nicht in der Engine, weil eine vollstaendige
 * Partie Mitspieler braucht -- und die Engine nichts von Bots wissen darf.
 */

import {
  applyAction,
  createGame,
  playerView,
  sortForDisplay,
  winnersOf,
  type Card,
  type GameEvent,
  type GameState,
  type Suit,
} from '@runecall/engine'

import { DIFFICULTIES, createBot, type Bot, type Difficulty } from './index.ts'

const NAMES = ['Anna', 'Ben', 'Chris', 'Dana', 'Emil', 'Fee'] as const

const SUIT_LABEL: Record<Suit, string> = {
  red: 'Rot',
  yellow: 'Gelb',
  green: 'Grün',
  blue: 'Blau',
}

const REASON_LABEL = {
  mage: 'erster Magier',
  trump: 'höchster Trumpf',
  'led-suit': 'höchste angespielte Farbe',
  'jesters-only': 'nur Narren, der erste gewinnt',
} as const

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'leicht',
  normal: 'normal',
  hard: 'schwer',
}

function cardLabel(card: Card): string {
  if (card.kind === 'mage') return 'Magier'
  if (card.kind === 'jester') return 'Narr'
  return `${SUIT_LABEL[card.suit]} ${card.value}`
}

const nameOf = (seat: number): string => NAMES[seat] ?? `Platz ${seat}`

/* ------------------------------------------------------------------ *
 * Ausgabe
 * ------------------------------------------------------------------ */

function describe(event: GameEvent, state: GameState): string | null {
  switch (event.type) {
    case 'round-dealt':
      return `\nRunde ${event.round} von ${state.totalRounds} — Geber: ${nameOf(event.dealer)}`

    case 'trump-revealed':
      if (event.card === null) return '  Trumpf: keiner (letzte Runde, das Deck geht auf)'
      if (event.suit === null) {
        return `  Trumpf: ${cardLabel(event.card)} aufgedeckt — ${
          event.card.kind === 'jester' ? 'kein Trumpf in dieser Runde' : 'der Geber wählt'
        }`
      }
      return `  Trumpf: ${cardLabel(event.card)} aufgedeckt — ${SUIT_LABEL[event.suit]} sticht`

    case 'trump-chosen':
      return `  ${nameOf(event.player)} wählt ${SUIT_LABEL[event.suit]} als Trumpf`

    case 'bid':
    case 'card-played':
      return null // wird gesammelt ausgegeben

    case 'trick-won': {
      const gelegt = event.plays
        .map((play) => `${nameOf(play.player)} ${cardLabel(play.card)}`)
        .join(' · ')
      return `  ${gelegt}\n      → ${nameOf(event.winner)} gewinnt (${REASON_LABEL[event.reason]})`
    }

    case 'round-scored': {
      const zeilen = event.points.map((punkte, seat) => {
        const bid = state.bids[seat] ?? 0
        const tricks = state.tricksWon[seat] ?? 0
        return `${nameOf(seat)} ${bid}/${tricks} ${punkte >= 0 ? '+' : ''}${punkte}`
      })
      return `  Wertung: ${zeilen.join(' · ')}\n  Stand:   ${event.totals
        .map((total, seat) => `${nameOf(seat)} ${total}`)
        .join(' · ')}`
    }

    case 'game-over':
      return `\n${'='.repeat(60)}\nPartie zu Ende. Sieger: ${event.winners.map(nameOf).join(' und ')}`
  }
}

/* ------------------------------------------------------------------ *
 * Ablauf
 * ------------------------------------------------------------------ */

function run(playerCount: number, seed: number, difficulty: Difficulty): void {
  console.log(
    `Runecall — ${playerCount} Bots auf Stufe ${DIFFICULTY_LABEL[difficulty]}, Startwert ${seed}`,
  )

  const bots: Bot[] = Array.from({ length: playerCount }, (_, seat) =>
    createBot(difficulty, seed + seat * 7919),
  )
  const botAt = (seat: number): Bot => {
    const bot = bots[seat]
    if (bot === undefined) throw new Error(`Kein Bot auf Platz ${seat}`)
    return bot
  }

  let state = createGame({ playerCount, seed })
  let printed = 0
  let guard = 0

  const flush = (): void => {
    for (; printed < state.events.length; printed++) {
      const event = state.events[printed]
      if (event === undefined) continue
      const line = describe(event, state)
      if (line !== null) console.log(line)
    }
  }

  while (state.phase !== 'game-over') {
    if (guard++ > 10_000) throw new Error('Die Partie kommt nicht zum Ende')
    const view = playerView(state, state.turn)

    switch (state.phase) {
      case 'trump-choice':
        flush()
        state = applyAction(state, {
          type: 'choose-trump',
          suit: botAt(state.dealer).chooseTrump(playerView(state, state.dealer)),
        })
        break

      case 'bidding': {
        const last = state.bids.filter((bid) => bid === null).length === 1
        state = applyAction(state, { type: 'bid', value: botAt(state.turn).chooseBid(view) })
        if (last) {
          flush()
          console.log('  Hände:')
          for (let seat = 0; seat < playerCount; seat++) {
            const hand = sortForDisplay(state.hands[seat] ?? [], state.trumpSuit)
            console.log(`    ${nameOf(seat).padEnd(6)} ${hand.map(cardLabel).join(', ')}`)
          }
          console.log(
            `  Ansagen: ${state.bids.map((bid, seat) => `${nameOf(seat)} ${bid ?? '–'}`).join(' · ')}`,
          )
        }
        break
      }

      case 'playing':
        state = applyAction(state, { type: 'play', cardId: botAt(state.turn).chooseCard(view) })
        flush()
        break

      case 'round-end':
        flush()
        state = applyAction(state, { type: 'next-round' })
        break
    }
  }

  flush()

  const best = winnersOf(state.scores)
  console.log(
    `Endstand: ${state.scores
      .map((score, seat) => `${nameOf(seat)} ${score}${best.includes(seat) ? ' ★' : ''}`)
      .join(' · ')}\n`,
  )
}

const args = process.argv.slice(2)
const playerCount = Number(args[0] ?? 4)
const seed = Number(args[1] ?? 4711)
const wanted = args[2]
const difficulty: Difficulty =
  wanted !== undefined && DIFFICULTIES.includes(wanted as Difficulty)
    ? (wanted as Difficulty)
    : 'normal'

run(playerCount, seed, difficulty)
