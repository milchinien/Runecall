/**
 * Die Beispiele aus dem Regelwerk, eins zu eins als Tests.
 *
 * docs/01-REGELWERK.md nennt seine Beispiele ausdruecklich "als Testfaelle
 * verwendbar". Genau das passiert hier: jeder Test traegt die Nummer seines
 * Abschnitts, damit eine Regelaenderung sofort findet, was sie umwirft.
 */

import { describe, expect, it } from 'vitest'

import {
  DECK_SIZE,
  createDeck,
  isJester,
  isMage,
  isPip,
  ledSuitOf,
  isLegalPlay,
  legalPlays,
  playViolation,
  roundCount,
  roundScore,
  trickWinner,
  winnersOf,
  type Card,
  type PipValue,
  type Play,
  type Suit,
} from '../src/index.ts'

const pip = (suit: Suit, value: PipValue): Card => ({ id: `${suit}-${value}`, kind: 'pip', suit, value })
const mage = (n: number): Card => ({ id: `mage-${n}`, kind: 'mage' })
const jester = (n: number): Card => ({ id: `jester-${n}`, kind: 'jester' })

/** Baut einen Stich; Sitzplatz 0 hat eroeffnet. */
const trickOf = (...cards: Card[]): Play[] => cards.map((card, player) => ({ player, card }))

describe('Abschnitt 1 -- Kartendeck', () => {
  it('besteht aus 60 Karten: 52 Zahlenkarten, 4 Magier, 4 Narren', () => {
    const deck = createDeck()

    expect(deck).toHaveLength(60)
    expect(DECK_SIZE).toBe(60)
    expect(deck.filter(isPip)).toHaveLength(52)
    expect(deck.filter(isMage)).toHaveLength(4)
    expect(deck.filter(isJester)).toHaveLength(4)
  })

  it('gibt jeder Karte eine eigene ID, auch den vier gleichwertigen Magiern', () => {
    const ids = new Set(createDeck().map((card) => card.id))
    expect(ids.size).toBe(60)
  })
})

describe('Abschnitt 2 -- Rundenzahl', () => {
  it.each([
    [3, 20],
    [4, 15],
    [5, 12],
    [6, 10],
  ])('%i Spieler ergeben %i Runden', (players, rounds) => {
    expect(roundCount(players)).toBe(rounds)
  })

  it('braucht in der letzten Runde das Deck exakt auf', () => {
    for (const players of [3, 4, 5, 6]) {
      expect(roundCount(players) * players).toBe(DECK_SIZE)
    }
  })
})

describe('Abschnitt 6.1 -- angespielte Farbe', () => {
  it('Zahlenkarte legt ihre Farbe fest', () => {
    expect(ledSuitOf(trickOf(pip('green', 5)))).toEqual({ suit: 'green', settled: true })
  })

  it('Magier legt keine Farbe fest -- alle Folgenden sind frei', () => {
    expect(ledSuitOf(trickOf(mage(1)))).toEqual({ suit: null, settled: true })
  })

  it('Narr laesst die Farbe offen, die naechste Zahlenkarte entscheidet', () => {
    expect(ledSuitOf(trickOf(jester(1)))).toEqual({ suit: null, settled: false })
    expect(ledSuitOf(trickOf(jester(1), pip('green', 5)))).toEqual({ suit: 'green', settled: true })
  })

  it('Narr, dann Magier: fuer den Rest des Stichs keine Farbe', () => {
    expect(ledSuitOf(trickOf(jester(1), mage(1)))).toEqual({ suit: null, settled: true })
  })

  it('nur Narren: es wird nie eine Farbe angespielt', () => {
    expect(ledSuitOf(trickOf(jester(1), jester(2), jester(3)))).toEqual({ suit: null, settled: false })
  })
})

describe('Abschnitt 6.2 -- Bedienpflicht', () => {
  const hand = [pip('green', 4), pip('red', 12), mage(1), jester(1)]
  const opened = trickOf(pip('green', 9))

  it('zwingt zur angespielten Farbe, wenn man sie hat', () => {
    expect(playViolation(pip('red', 12), hand, opened)).toEqual({
      code: 'must-follow-suit',
      suit: 'green',
    })
    expect(isLegalPlay(pip('green', 4), hand, opened)).toBe(true)
  })

  it('laesst Magier und Narr immer zu', () => {
    expect(isLegalPlay(mage(1), hand, opened)).toBe(true)
    expect(isLegalPlay(jester(1), hand, opened)).toBe(true)
  })

  it('gibt genau die drei erlaubten Karten zurueck', () => {
    expect(legalPlays(hand, opened).map((card) => card.id)).toEqual(['green-4', 'mage-1', 'jester-1'])
  })

  it('kennt keine Trumpfpflicht: wer nicht bedienen kann, darf alles', () => {
    const ohneGruen = [pip('red', 12), pip('blue', 2)]
    expect(legalPlays(ohneGruen, opened)).toHaveLength(2)
  })

  it('laesst alles zu, wenn keine Farbe angespielt ist', () => {
    expect(legalPlays(hand, trickOf(mage(2)))).toHaveLength(4)
    expect(legalPlays(hand, trickOf(jester(2)))).toHaveLength(4)
    expect(legalPlays(hand, [])).toHaveLength(4)
  })
})

describe('Abschnitt 8 -- vollstaendige Beispiele', () => {
  it('8.1 Trumpf schlaegt die hohe Farbkarte', () => {
    const result = trickWinner(
      trickOf(pip('green', 10), pip('green', 12), pip('red', 4), pip('green', 13)),
      'red',
    )
    expect(result.winner).toBe(2)
    expect(result.reason).toBe('trump')
  })

  it('8.2 fremde Farbe verliert trotz hoher Zahl', () => {
    const result = trickWinner(
      trickOf(pip('green', 8), pip('green', 12), pip('blue', 13), pip('green', 10)),
      'red',
    )
    expect(result.winner).toBe(1)
    expect(result.reason).toBe('led-suit')
  })

  it('8.3 der zuerst gespielte Magier gewinnt', () => {
    const result = trickWinner(trickOf(mage(1), mage(2), pip('red', 13), mage(3)), 'red')
    expect(result.winner).toBe(0)
    expect(result.reason).toBe('mage')
  })

  it('8.4 Narr-Anspiel legt die Farbe nicht fest', () => {
    const result = trickWinner(
      trickOf(jester(1), pip('green', 5), pip('green', 9), pip('blue', 2)),
      'blue',
    )
    expect(result.winner).toBe(3)
    expect(result.reason).toBe('trump')
  })

  it('8.5 nur Narren -- der zuerst gespielte gewinnt', () => {
    const result = trickWinner(trickOf(jester(1), jester(2), jester(3)), 'blue')
    expect(result.winner).toBe(0)
    expect(result.reason).toBe('jesters-only')
  })

  it('8.6 Mini-Runde: Magier schlaegt Trumpf und Farbe', () => {
    const result = trickWinner(trickOf(pip('red', 10), mage(1), pip('blue', 7)), 'green')
    expect(result.winner).toBe(1)
    expect(result.reason).toBe('mage')
  })

  it('ohne Trumpf entscheidet allein die angespielte Farbe', () => {
    const result = trickWinner(
      trickOf(pip('green', 8), pip('blue', 13), pip('green', 9)),
      null,
    )
    expect(result.winner).toBe(2)
    expect(result.reason).toBe('led-suit')
  })
})

describe('Abschnitt 7 -- Wertung', () => {
  it.each([
    [0, 20],
    [1, 30],
    [2, 40],
    [3, 50],
    [4, 60],
    [5, 70],
  ])('Ansage %i exakt getroffen gibt %i Punkte', (bid, points) => {
    expect(roundScore(bid, bid)).toBe(points)
  })

  it.each([
    [2, 1, -10],
    [2, 0, -20],
    [2, 4, -20],
    [4, 1, -30],
  ])('Ansage %i bei %i Stichen gibt %i Punkte', (bid, tricks, points) => {
    expect(roundScore(bid, tricks)).toBe(points)
  })

  it('bestraft zu viele und zu wenige Stiche gleich hart', () => {
    expect(roundScore(3, 1)).toBe(roundScore(3, 5))
  })

  it('teilt den Sieg bei Gleichstand', () => {
    expect(winnersOf([120, 90, 120])).toEqual([0, 2])
    expect(winnersOf([-30, -10, -80])).toEqual([1])
  })
})
