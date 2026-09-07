/**
 * Die Wertung der gewerteten Partie.
 *
 * Zwei Dinge muessen stimmen, sonst stimmt der Rang nie: welcher Platz aus
 * den Punktstaenden folgt, und was dieser Platz kostet oder bringt. Beides
 * sind reine Funktionen und deshalb ohne Browser pruefbar.
 */

import { describe, expect, it } from 'vitest'

import {
  RANK_POINTS,
  nextTier,
  placementOf,
  rankPointsFor,
  recordRankedResult,
  tierOf,
} from '../src/rank.ts'
import { clampRounds, createRoomCode, isRoomCode, normalizeRoomCode } from '../src/match.ts'

describe('Platz und Punkte', () => {
  it('zaehlt den Platz aus den Punktstaenden', () => {
    const scores = [30, 90, -10, 50]

    expect(placementOf(scores, 1)).toBe(1)
    expect(placementOf(scores, 3)).toBe(2)
    expect(placementOf(scores, 0)).toBe(3)
    expect(placementOf(scores, 2)).toBe(4)
  })

  // Geteilter Sieg (Entscheidung 11): zwei Erste sind beide Erste, der
  // Naechste ist Dritter -- er hat nicht besser gespielt, weil zwei andere
  // gleich gut waren.
  it('teilt den Platz bei Gleichstand', () => {
    const scores = [60, 60, 20, 20]

    expect(placementOf(scores, 0)).toBe(1)
    expect(placementOf(scores, 1)).toBe(1)
    expect(placementOf(scores, 2)).toBe(3)
    expect(placementOf(scores, 3)).toBe(3)
  })

  it('gibt +5, +2, -1 und -4 nach Platz', () => {
    expect([1, 2, 3, 4].map(rankPointsFor)).toEqual([5, 2, -1, -4])
  })

  it('behandelt Plaetze jenseits der Tabelle wie den letzten', () => {
    expect(rankPointsFor(9)).toBe(RANK_POINTS[RANK_POINTS.length - 1])
  })

  // Die Summe ueber alle vier Plaetze ist leicht positiv. Eine Wertung, die
  // im Schnitt nur abzieht, bestraft das Spielen selbst.
  it('summiert sich ueber einen ganzen Tisch zu einem Plus', () => {
    expect(RANK_POINTS.reduce((total, value) => total + value, 0)).toBe(2)
  })
})

describe('Rangstand', () => {
  // Ohne Browserspeicher faengt jeder Aufruf bei null an -- was hier genau
  // richtig ist: Beide Faelle beginnen bei einem frischen Konto.
  it('verbucht den Sieg mit +5', () => {
    const result = recordRankedResult(1)

    expect(result.delta).toBe(5)
    expect(result.rank).toEqual({ points: 5, games: 1, wins: 1 })
  })

  it('faellt nicht unter null und meldet die tatsaechliche Aenderung', () => {
    const result = recordRankedResult(4)

    expect(result.rank.points).toBe(0)
    expect(result.delta).toBe(0)
    expect(result.rank.wins).toBe(0)
  })

  it('benennt die Stufen aufsteigend', () => {
    expect(tierOf(0)).toBe('Funke')
    expect(tierOf(24)).toBe('Funke')
    expect(tierOf(25)).toBe('Rune')
    expect(tierOf(1000)).toBe('Erzmagier')

    expect(nextTier(0)?.name).toBe('Rune')
    expect(nextTier(1000)).toBeNull()
  })
})

describe('Raum und Rundenzahl', () => {
  it('haelt die Rundenzahl in dem, was das Deck hergibt', () => {
    expect(clampRounds(null, 4)).toBe(15)
    expect(clampRounds(8, 4)).toBe(8)
    // Zehn Runden gehen zu viert, zu sechst nicht mehr.
    expect(clampRounds(10, 6)).toBe(10)
    expect(clampRounds(12, 6)).toBe(10)
    expect(clampRounds(0, 4)).toBe(1)
  })

  it('macht aus getippten Zeichen einen Raumcode', () => {
    expect(normalizeRoomCode('ab-cd e')).toBe('ABCDE')
    expect(normalizeRoomCode('abcdefgh')).toBe('ABCDE')
    // Die verwechselbaren Zeichen gibt es im Alphabet nicht -- sie fallen
    // beim Tippen weg, und der Code bleibt sichtbar zu kurz.
    expect(normalizeRoomCode('O0I1S5')).toBe('')
    expect(isRoomCode('O0I1S5')).toBe(false)
  })

  it('wuerfelt Codes, die als Codes durchgehen', () => {
    for (let i = 0; i < 50; i++) {
      const code = createRoomCode()
      expect(isRoomCode(code)).toBe(true)
      expect(normalizeRoomCode(code)).toBe(code)
    }
  })
})
