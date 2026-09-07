/**
 * Zufallspartien gegen die Invarianten aus docs/01-REGELWERK.md, Abschnitt 9.
 *
 * Die Beispiele in rulebook.test.ts pruefen einzelne Regeln. Hier laufen
 * ganze Partien durch -- alle Spielerzahlen, viele Startwerte -- und nach
 * jedem Zug muss gelten, was gelten muss. Genau so faengt man die Faelle,
 * die niemand von Hand aufschreibt.
 *
 * Die Partie waehlt ihre Zuege selbst zufaellig, aber mit festem Startwert:
 * ein fehlgeschlagener Lauf ist damit exakt wiederholbar.
 */

import { describe, expect, it } from 'vitest'

import {
  DECK_SIZE,
  RuleError,
  SUITS,
  applyAction,
  createGame,
  createRng,
  legalPlays,
  roundCount,
  roundScore,
  type Card,
  type GameState,
} from '../src/index.ts'

/** Alle Karten, die der Zustand gerade kennt. Gelegte stecken in `playedCards`. */
function allCards(state: GameState): Card[] {
  return [...state.hands.flatMap((hand) => [...hand]), ...state.stock, ...state.playedCards]
}

function checkInvariants(state: GameState): void {
  const cards = allCards(state)

  // 1. Jede der 60 Karten existiert genau einmal.
  expect(cards).toHaveLength(DECK_SIZE)
  expect(new Set(cards.map((card) => card.id)).size).toBe(DECK_SIZE)

  // 2. Zu Rundenbeginn hat jeder genau so viele Karten wie die Rundennummer.
  if (state.playedCards.length === 0 && state.phase !== 'game-over' && state.phase !== 'round-end') {
    for (const hand of state.hands) {
      expect(hand).toHaveLength(state.roundNumber)
    }
  }

  // 4. Jede abgegebene Ansage liegt in 0..n.
  for (const bid of state.bids) {
    if (bid !== null) {
      expect(bid).toBeGreaterThanOrEqual(0)
      expect(bid).toBeLessThanOrEqual(state.roundNumber)
    }
  }

  // 6. Niemand gewinnt mehr Stiche, als er Karten hatte.
  for (const won of state.tricksWon) {
    expect(won).toBeLessThanOrEqual(state.roundNumber)
  }

  // Ein vollstaendiger Stich bleibt nie liegen: er ist ausgewertet, bevor
  // irgendjemand wieder am Zug ist. Sonst passt eine Karte zu viel hinein.
  expect(state.currentTrick.length).toBeLessThan(state.playerCount)

  if (state.phase === 'round-end' || state.phase === 'game-over') {
    // 3. Die Stichsumme einer Runde ist genau die Rundennummer.
    const sum = state.tricksWon.reduce((total, won) => total + won, 0)
    expect(sum).toBe(state.roundNumber)
    for (const hand of state.hands) {
      expect(hand).toHaveLength(0)
    }
  }
}

/** Spielt eine ganze Partie und prueft nach jedem Zug. Liefert den Endzustand. */
function playFullGame(playerCount: number, seed: number, totalRounds?: number): GameState {
  const choices = createRng(seed ^ 0x5eed)
  let state = createGame({ playerCount, seed, totalRounds })
  let rejected = 0
  let guard = 0

  while (state.phase !== 'game-over') {
    if (guard++ > 10_000) throw new Error('Die Partie kommt nicht zum Ende')
    checkInvariants(state)

    switch (state.phase) {
      case 'trump-choice': {
        const suit = SUITS[choices.nextInt(SUITS.length)] ?? 'red'
        state = applyAction(state, { type: 'choose-trump', suit })
        break
      }

      case 'bidding': {
        // 4. Ausserhalb von 0..n wird abgelehnt.
        expect(() => applyAction(state, { type: 'bid', value: state.roundNumber + 1 })).toThrow(RuleError)
        expect(() => applyAction(state, { type: 'bid', value: -1 })).toThrow(RuleError)
        state = applyAction(state, { type: 'bid', value: choices.nextInt(state.roundNumber + 1) })
        break
      }

      case 'playing': {
        const hand = state.hands[state.turn] ?? []
        const legal = legalPlays(hand, state.currentTrick)

        // 5. Wer am Zug ist, hat immer mindestens eine erlaubte Karte.
        expect(legal.length).toBeGreaterThan(0)

        // 5. Und eine gesperrte Karte wird tatsaechlich abgelehnt.
        if (legal.length < hand.length) {
          const blocked = hand.find((card) => !legal.some((allowed) => allowed.id === card.id))
          expect(blocked).toBeDefined()
          if (blocked !== undefined) {
            expect(() => applyAction(state, { type: 'play', cardId: blocked.id })).toThrow(RuleError)
            rejected++
          }
        }

        const card = legal[choices.nextInt(legal.length)] ?? legal[0]
        if (card === undefined) throw new Error('Keine spielbare Karte')
        state = applyAction(state, { type: 'play', cardId: card.id })
        break
      }

      case 'round-end': {
        state = applyAction(state, { type: 'next-round' })
        break
      }
    }
  }

  checkInvariants(state)

  // Es muss ueberhaupt Situationen mit Bedienpflicht gegeben haben, sonst
  // prueft der Test oben ins Leere.
  expect(rejected).toBeGreaterThan(0)

  return state
}

describe('Abschnitt 9 -- Invarianten in ganzen Partien', () => {
  it.each([3, 4, 5, 6])('haelt bei %i Spielern ueber drei Partien durch', (playerCount) => {
    for (const seed of [1, 4711, 20250820]) {
      const end = playFullGame(playerCount, seed)

      expect(end.phase).toBe('game-over')
      expect(end.roundNumber).toBe(roundCount(playerCount))
      expect(end.totalRounds).toBe(roundCount(playerCount))
    }
  })

  it('wertet jede Runde genau nach Ansage und Stichen (Invariante 7)', () => {
    const end = playFullGame(4, 99)

    const scored = end.events.filter((event) => event.type === 'round-scored')
    expect(scored).toHaveLength(roundCount(4))

    // Die Punkte jeder Runde muessen sich allein aus Ansage und Stichen
    // ergeben -- ohne versteckte Zufallskomponente.
    let running = [0, 0, 0, 0]
    for (const event of scored) {
      if (event.type !== 'round-scored') continue
      running = running.map((total, seat) => total + (event.points[seat] ?? 0))
      expect([...event.totals]).toEqual(running)
    }
    expect([...end.scores]).toEqual(running)
  })

  it('gibt in der letzten Runde keinen Trumpf, weil das Deck aufgeht (4.4)', () => {
    for (const playerCount of [3, 4, 5, 6]) {
      let state = createGame({ playerCount, seed: 7 })
      const letzte = roundCount(playerCount)

      // Bis zur letzten Runde durchreichen, ohne zu spielen: dafuer wird jede
      // Runde regulaer zu Ende gebracht.
      state = playFullGame(playerCount, 7)

      const trumpEvents = state.events.filter((event) => event.type === 'trump-revealed')
      expect(trumpEvents).toHaveLength(letzte)

      const last = trumpEvents[letzte - 1]
      expect(last).toBeDefined()
      if (last !== undefined && last.type === 'trump-revealed') {
        expect(last.card).toBeNull()
        expect(last.suit).toBeNull()
      }
    }
  })

  it('liefert bei gleichem Startwert exakt dieselbe Partie (Invariante 8)', () => {
    const a = playFullGame(5, 31337)
    const b = playFullGame(5, 31337)

    expect(JSON.stringify(b.events)).toBe(JSON.stringify(a.events))
    expect([...b.scores]).toEqual([...a.scores])
  })

  it('spielt bei unterschiedlichem Startwert eine andere Partie', () => {
    const a = playFullGame(4, 1)
    const b = playFullGame(4, 2)

    expect(JSON.stringify(b.events)).not.toBe(JSON.stringify(a.events))
  })
})

describe('Abgelehnte Zuege', () => {
  it('nimmt keine Ansage, solange der Geber den Trumpf nicht gewaehlt hat', () => {
    // Startwert so gewaehlt, dass in Runde 1 ein Magier aufgedeckt wird.
    let state = createGame({ playerCount: 4, seed: 1 })
    let tries = 0
    while (state.phase !== 'trump-choice' && tries < 500) {
      state = createGame({ playerCount: 4, seed: ++tries })
    }

    expect(state.phase).toBe('trump-choice')
    expect(() => applyAction(state, { type: 'bid', value: 0 })).toThrow(RuleError)
    expect(() => applyAction(state, { type: 'next-round' })).toThrow(RuleError)
  })

  it('nimmt keine Karte, solange noch angesagt wird', () => {
    const state = createGame({ playerCount: 4, seed: 2024 })
    const hand = state.hands[state.turn] ?? []
    const card = hand[0]

    expect(card).toBeDefined()
    if (card !== undefined && state.phase === 'bidding') {
      expect(() => applyAction(state, { type: 'play', cardId: card.id })).toThrow(RuleError)
    }
  })

  it('lehnt eine Karte ab, die gar nicht auf der Hand liegt', () => {
    let state = createGame({ playerCount: 3, seed: 5 })
    while (state.phase === 'trump-choice') {
      state = applyAction(state, { type: 'choose-trump', suit: 'red' })
    }
    while (state.phase === 'bidding') {
      state = applyAction(state, { type: 'bid', value: 0 })
    }

    expect(state.phase).toBe('playing')
    expect(() => applyAction(state, { type: 'play', cardId: 'gibt-es-nicht' })).toThrow(RuleError)
  })

  it('laesst sich nicht mit unmoeglichen Spielerzahlen starten', () => {
    expect(() => createGame({ playerCount: 2, seed: 1 })).toThrow(RuleError)
    expect(() => createGame({ playerCount: 7, seed: 1 })).toThrow(RuleError)
    expect(() => createGame({ playerCount: 4, seed: 1, dealer: 4 })).toThrow(RuleError)
  })

  // Eine kuerzere Partie ist dieselbe Partie: Sie hoert frueher auf, sonst
  // aendert sich nichts. Gebraucht wird das im eigenen Raum (frei einstellbar)
  // und in der gewerteten Partie (fest acht Runden).
  it('endet nach der vereinbarten Rundenzahl (Entscheidungen 4 und 4b)', () => {
    const end = playFullGame(4, 20260904, 8)

    expect(end.phase).toBe('game-over')
    expect(end.totalRounds).toBe(8)
    expect(end.roundNumber).toBe(8)
    expect(end.events.filter((event) => event.type === 'round-scored')).toHaveLength(8)
  })

  it('nimmt keine Rundenzahl an, die das Deck nicht hergibt', () => {
    expect(() => createGame({ playerCount: 4, seed: 1, totalRounds: 0 })).toThrow(RuleError)
    expect(() => createGame({ playerCount: 4, seed: 1, totalRounds: 2.5 })).toThrow(RuleError)
    expect(() =>
      createGame({ playerCount: 6, seed: 1, totalRounds: roundCount(6) + 1 }),
    ).toThrow(RuleError)
  })

  it('rechnet die Wertung auch bei uebertroffener Ansage negativ', () => {
    expect(roundScore(0, 3)).toBe(-30)
  })
})
