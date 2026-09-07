/**
 * Die Regeln von Runecall.
 *
 * Reine Funktionen ohne Zustand: welche Farbe ist angespielt, welche Karte
 * darf gelegt werden, wer gewinnt den Stich, was bringt eine Runde an
 * Punkten. Grundlage ist docs/01-REGELWERK.md; die Abschnittsnummern stehen
 * an den Funktionen, damit Regel und Code auffindbar zusammenbleiben.
 *
 * Alles hier ist ohne Spielzustand pruefbar -- das ist der Grund, warum diese
 * Funktionen nicht in game.ts stehen.
 */

import { DECK_SIZE, SUITS, isPip, type Card, type Suit } from './cards.ts'

/** Erlaubte Spielerzahlen (Regelwerk 2, Entscheidung 2). */
export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 6

/** Eine gelegte Karte samt Sitzplatz. */
export type Play = {
  readonly player: number
  readonly card: Card
}

/**
 * Rundenzahl je Spielerzahl (Regelwerk 2): floor(60 / Spielerzahl).
 *
 * In Runde n bekommt jeder n Karten. In der letzten Runde geht das Deck
 * genau auf -- deshalb bleibt dort keine Karte fuer den Trumpf uebrig.
 */
export function roundCount(playerCount: number): number {
  return Math.floor(DECK_SIZE / playerCount)
}

/* ------------------------------------------------------------------ *
 * Angespielte Farbe (Regelwerk 6.1)
 * ------------------------------------------------------------------ */

/**
 * `settled` trennt zwei Faelle, die beide "gerade keine Farbe" bedeuten,
 * aber verschiedene Folgen haben:
 *
 * - `settled: true` mit `suit: null` -- ein Magier fiel, bevor eine
 *   Zahlenkarte kam. In diesem Stich wird keine Farbe mehr angespielt,
 *   alle Folgenden sind frei.
 * - `settled: false` -- bisher liegen nur Narren. Die naechste Zahlenkarte
 *   legt die Farbe noch fest.
 *
 * Fuer die Bedienpflicht macht das keinen Unterschied, fuer die Anzeige
 * schon: einmal "frei", einmal "noch offen".
 */
export type LedSuit = {
  readonly suit: Suit | null
  readonly settled: boolean
}

export function ledSuitOf(trick: readonly Play[]): LedSuit {
  for (const play of trick) {
    if (play.card.kind === 'mage') return { suit: null, settled: true }
    if (isPip(play.card)) return { suit: play.card.suit, settled: true }
  }
  return { suit: null, settled: false }
}

/* ------------------------------------------------------------------ *
 * Bedienpflicht (Regelwerk 6.2)
 * ------------------------------------------------------------------ */

/**
 * Warum eine Karte gerade nicht gelegt werden darf.
 *
 * Bewusst als Datum und nicht als fertiger Satz: Die Engine kennt keine
 * Sprache. Den Hinweis "Du musst Gruen bedienen" (Frage 12) formuliert der
 * Client aus `suit`.
 */
export type PlayViolation = {
  readonly code: 'must-follow-suit'
  readonly suit: Suit
}

/**
 * Prueft eine einzelne Karte gegen die Bedienpflicht.
 *
 * Magier und Narr duerfen immer gelegt werden -- das ist die einzige
 * Ausnahme, und sie gilt ohne Einschraenkung. Eine Trumpfpflicht gibt es
 * nicht: wer nicht bedienen kann, darf alles.
 */
export function playViolation(
  card: Card,
  hand: readonly Card[],
  trick: readonly Play[],
): PlayViolation | null {
  const led = ledSuitOf(trick)

  // Keine Farbe angespielt (Magier eroeffnete, oder es liegen nur Narren).
  if (led.suit === null) return null

  // Magier und Narr sind von der Bedienpflicht ausgenommen.
  if (!isPip(card)) return null

  if (card.suit === led.suit) return null

  const canFollow = hand.some((held) => isPip(held) && held.suit === led.suit)
  return canFollow ? { code: 'must-follow-suit', suit: led.suit } : null
}

export const isLegalPlay = (card: Card, hand: readonly Card[], trick: readonly Play[]): boolean =>
  playViolation(card, hand, trick) === null

/** Alle Karten der Hand, die gerade gelegt werden duerfen. */
export function legalPlays(hand: readonly Card[], trick: readonly Play[]): Card[] {
  return hand.filter((card) => isLegalPlay(card, hand, trick))
}

/* ------------------------------------------------------------------ *
 * Stichgewinner (Regelwerk 6.3)
 * ------------------------------------------------------------------ */

/** Welche Regel den Stich entschieden hat -- fuer Log und Erklaerungen. */
export type WinReason = 'mage' | 'trump' | 'led-suit' | 'jesters-only'

export type TrickResult = {
  readonly winner: number
  readonly card: Card
  readonly reason: WinReason
}

/** Hoechste Zahlenkarte einer bestimmten Farbe im Stich. */
function highestPip(trick: readonly Play[], suit: Suit): Play | null {
  let best: Play | null = null

  for (const play of trick) {
    if (!isPip(play.card)) continue
    if (play.card.suit !== suit) continue
    if (best === null || !isPip(best.card) || play.card.value > best.card.value) {
      best = play
    }
  }

  return best
}

/**
 * Wer gewinnt den Stich. Die erste zutreffende Regel entscheidet:
 *
 * 1. Magier im Stich -> der zuerst gespielte gewinnt.
 * 2. Trumpf im Stich -> der hoechste Trumpf gewinnt.
 * 3. Sonst -> die hoechste Karte der angespielten Farbe.
 * 4. Nur Narren -> der zuerst gespielte Narr.
 *
 * Ohne Trumpf (aufgedeckter Narr oder letzte Runde) entfaellt Schritt 2.
 */
export function trickWinner(trick: readonly Play[], trump: Suit | null): TrickResult {
  const first = trick[0]
  if (first === undefined) {
    throw new RangeError('Ein leerer Stich hat keinen Gewinner')
  }

  const mage = trick.find((play) => play.card.kind === 'mage')
  if (mage !== undefined) {
    return { winner: mage.player, card: mage.card, reason: 'mage' }
  }

  if (trump !== null) {
    const best = highestPip(trick, trump)
    if (best !== null) {
      return { winner: best.player, card: best.card, reason: 'trump' }
    }
  }

  const led = ledSuitOf(trick)
  if (led.suit !== null) {
    const best = highestPip(trick, led.suit)
    if (best !== null) {
      return { winner: best.player, card: best.card, reason: 'led-suit' }
    }
  }

  // Es liegen ausschliesslich Narren. Der Stich hat trotzdem einen Gewinner:
  // er zaehlt fuer dessen Ansage und er eroeffnet den naechsten Stich.
  return { winner: first.player, card: first.card, reason: 'jesters-only' }
}

/* ------------------------------------------------------------------ *
 * Wertung (Regelwerk 7)
 * ------------------------------------------------------------------ */

/**
 * Punkte einer Runde fuer einen Spieler.
 *
 * Getroffen: 20 + 10 x Ansage. Verfehlt: -10 je Stich Abweichung.
 * Zu viele und zu wenige Stiche sind gleich schlecht -- das ist der Kern
 * des Spiels und der Grund, warum eine hohe Ansage riskant bleibt.
 */
export function roundScore(bid: number, tricksWon: number): number {
  return bid === tricksWon ? 20 + 10 * bid : -10 * Math.abs(bid - tricksWon)
}

/**
 * Die Sieger einer Partie: hoechste Gesamtpunktzahl.
 *
 * Liefert bei Gleichstand mehrere Sitzplaetze -- geteilter Sieg
 * (Entscheidung zu Frage 11).
 */
export function winnersOf(scores: readonly number[]): number[] {
  const best = Math.max(...scores)
  const winners: number[] = []

  scores.forEach((score, seat) => {
    if (score === best) winners.push(seat)
  })

  return winners
}

/* ------------------------------------------------------------------ *
 * Darstellung
 * ------------------------------------------------------------------ */

/**
 * Sortiert eine Hand fuer die Anzeige: Magier zuerst, dann die Farben mit
 * Trumpf vorne und absteigenden Werten, Narren zuletzt (Frage 13).
 *
 * Reine Darstellungshilfe ohne Regelwirkung -- die Engine haelt die Haende
 * bewusst in Austeilreihenfolge, damit nichts von der Sortierung abhaengt.
 */
export function sortForDisplay(hand: readonly Card[], trump: Suit | null): Card[] {
  const kindRank = (card: Card): number =>
    card.kind === 'mage' ? 0 : card.kind === 'jester' ? 2 : 1

  const suitRank = (suit: Suit): number => (suit === trump ? -1 : SUITS.indexOf(suit))

  return hand.slice().sort((a, b) => {
    const byKind = kindRank(a) - kindRank(b)
    if (byKind !== 0) return byKind

    if (isPip(a) && isPip(b)) {
      const bySuit = suitRank(a.suit) - suitRank(b.suit)
      if (bySuit !== 0) return bySuit
      return b.value - a.value
    }

    return a.id < b.id ? -1 : 1
  })
}
