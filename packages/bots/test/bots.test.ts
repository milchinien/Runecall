/**
 * Die Bots am ganzen Spiel geprueft.
 *
 * Zwei Fragen stehen hier im Mittelpunkt. Erstens: haelt sich jede Stufe an
 * die Regeln? Das prueft die Engine selbst -- sie lehnt jeden unerlaubten Zug
 * ab, also genuegt es, ganze Partien durchlaufen zu lassen. Zweitens: ist
 * "schwer" tatsaechlich schwerer? Eine Stufe, die sich nicht messen laesst,
 * ist keine Stufe.
 */

import { describe, expect, it } from 'vitest'

import {
  applyAction,
  createGame,
  playerView,
  roundCount,
  type Card,
  type GameState,
  type PipValue,
  type Suit,
} from '@runecall/engine'

import { DIFFICULTIES, couldBeat, createBot, estimateTricks, type Difficulty } from '../src/index.ts'

const pip = (suit: Suit, value: PipValue): Card => ({ id: `${suit}-${value}`, kind: 'pip', suit, value })
const mage: Card = { id: 'mage-1', kind: 'mage' }
const jester: Card = { id: 'jester-1', kind: 'jester' }

type Outcome = {
  readonly state: GameState
  /** Wie oft jeder Sitzplatz seine Ansage exakt getroffen hat. */
  readonly hits: readonly number[]
  readonly rounds: number
}

/** Spielt eine komplette Partie, in der alle Plaetze von Bots besetzt sind. */
function runTable(playerCount: number, seed: number, difficulties: readonly Difficulty[]): Outcome {
  const bots = Array.from({ length: playerCount }, (_, seat) =>
    createBot(difficulties[seat % difficulties.length] ?? 'normal', seed + seat * 7919),
  )
  const botAt = (seat: number) => {
    const bot = bots[seat]
    if (bot === undefined) throw new Error(`Kein Bot auf Platz ${seat}`)
    return bot
  }

  const hits = Array.from({ length: playerCount }, () => 0)
  let state = createGame({ playerCount, seed })
  let rounds = 0
  let guard = 0

  while (state.phase !== 'game-over') {
    if (guard++ > 10_000) throw new Error('Die Partie kommt nicht zum Ende')

    switch (state.phase) {
      case 'trump-choice':
        state = applyAction(state, {
          type: 'choose-trump',
          suit: botAt(state.dealer).chooseTrump(playerView(state, state.dealer)),
        })
        break

      case 'bidding': {
        const value = botAt(state.turn).chooseBid(playerView(state, state.turn))

        // Eine Ansage ausserhalb 0..n wuerde die Engine ablehnen -- der Bot
        // darf sie gar nicht erst vorschlagen.
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(state.roundNumber)

        state = applyAction(state, { type: 'bid', value })
        break
      }

      case 'playing':
        state = applyAction(state, {
          type: 'play',
          cardId: botAt(state.turn).chooseCard(playerView(state, state.turn)),
        })
        break

      case 'round-end':
        state.bids.forEach((bid, seat) => {
          if (bid !== null && bid === state.tricksWon[seat]) hits[seat] = (hits[seat] ?? 0) + 1
        })
        rounds++
        state = applyAction(state, { type: 'next-round' })
        break
    }
  }

  return { state, hits, rounds }
}

describe('Regeltreue', () => {
  it.each(DIFFICULTIES)('Stufe %s spielt Partien zu 3 bis 6 Spielern zu Ende', (difficulty) => {
    for (const playerCount of [3, 4, 5, 6]) {
      const outcome = runTable(playerCount, 1234 + playerCount, [difficulty])

      expect(outcome.state.phase).toBe('game-over')
      expect(outcome.rounds).toBe(roundCount(playerCount))
      for (const hand of outcome.state.hands) expect(hand).toHaveLength(0)
    }
  })

  it('bleibt bei gleichem Startwert exakt gleich', () => {
    const a = runTable(4, 555, ['normal'])
    const b = runTable(4, 555, ['normal'])

    expect([...b.state.scores]).toEqual([...a.state.scores])
    expect([...b.hits]).toEqual([...a.hits])
  })

  it('spielt am selben Tisch unterschiedlich, je nach Stufe', () => {
    const gemischt = runTable(4, 42, ['easy', 'hard', 'easy', 'hard'])
    const gleich = runTable(4, 42, ['normal'])

    expect([...gemischt.state.scores]).not.toEqual([...gleich.state.scores])
  })
})

describe('Die Stufen unterscheiden sich messbar', () => {
  /** Sitzplaetze 0 und 2 spielen die eine Stufe, 1 und 3 die andere. */
  function duell(stark: Difficulty, schwach: Difficulty): { stark: number; schwach: number } {
    let starkeTreffer = 0
    let schwacheTreffer = 0

    for (const seed of [7, 99, 512, 2024, 31337, 60607]) {
      const outcome = runTable(4, seed, [stark, schwach, stark, schwach])
      starkeTreffer += (outcome.hits[0] ?? 0) + (outcome.hits[2] ?? 0)
      schwacheTreffer += (outcome.hits[1] ?? 0) + (outcome.hits[3] ?? 0)
    }

    return { stark: starkeTreffer, schwach: schwacheTreffer }
  }

  it('normal trifft seine Ansage oefter als leicht', () => {
    const ergebnis = duell('normal', 'easy')
    expect(ergebnis.stark).toBeGreaterThan(ergebnis.schwach)
  })

  it('schwer trifft seine Ansage oefter als leicht', () => {
    const ergebnis = duell('hard', 'easy')
    expect(ergebnis.stark).toBeGreaterThan(ergebnis.schwach)
  })
})

describe('Kartenkenntnis', () => {
  it('kennt die Rangfolge Magier, Trumpf, Farbe, Narr', () => {
    expect(couldBeat(mage, pip('red', 13), 'red')).toBe(true)
    expect(couldBeat(pip('red', 13), mage, 'red')).toBe(false)

    expect(couldBeat(jester, pip('blue', 1), 'red')).toBe(false)
    expect(couldBeat(pip('blue', 1), jester, 'red')).toBe(true)

    // Trumpf schlaegt jede Farbkarte, unabhaengig vom Zahlenwert.
    expect(couldBeat(pip('red', 2), pip('blue', 13), 'red')).toBe(true)
    expect(couldBeat(pip('blue', 13), pip('red', 2), 'red')).toBe(false)

    // Fremde Farbe schlaegt nicht, auch nicht mit hoeherer Zahl.
    expect(couldBeat(pip('blue', 13), pip('green', 2), null)).toBe(false)

    // Gleiche Farbe entscheidet der Wert.
    expect(couldBeat(pip('green', 9), pip('green', 8), null)).toBe(true)
    expect(couldBeat(pip('green', 8), pip('green', 9), null)).toBe(false)
  })

  it('schaetzt eine starke Hand hoeher ein als eine schwache', () => {
    const state = createGame({ playerCount: 4, seed: 3 })
    const view = playerView(state, 0)

    const stark = { ...view, hand: [mage, pip('red', 13), pip('red', 12)], trumpSuit: 'red' as Suit }
    const schwach = { ...view, hand: [jester, pip('blue', 2), pip('green', 3)], trumpSuit: 'red' as Suit }

    expect(estimateTricks(stark)).toBeGreaterThan(estimateTricks(schwach))
    expect(estimateTricks(schwach)).toBeLessThan(1)
  })
})
