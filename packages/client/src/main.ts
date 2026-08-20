/**
 * Runecall -- Einstiegspunkt des Clients.
 *
 * Noch kein Spiel. Diese Seite zeigt das Deck aus der Engine und dient als
 * Nachweis, dass die Werkzeugkette steht: Arbeitsbereiche, strenge
 * TypeScript-Pruefung, Vite mit sofortigem Neuladen, und die Trennung
 * zwischen Engine (Regeln) und Client (Darstellung).
 */

import { createDeck, createRng, shuffle, DECK_SIZE, type Card } from '@runecall/engine'
import { SUIT_STYLES, createRune } from './runes.ts'
import './style.css'

const deck = createDeck()

/** Baut die Darstellung einer einzelnen Karte. */
function renderCard(card: Card): HTMLElement {
  const el = document.createElement('article')
  el.className = `card card--${card.kind}`

  if (card.kind === 'pip') {
    const style = SUIT_STYLES[card.suit]
    el.classList.add(`card--${card.suit}`)
    el.title = `${style.label} ${card.value} — Rune ${style.runeName}`

    const value = document.createElement('span')
    value.className = 'card__value'
    value.textContent = String(card.value)

    el.append(createRune(card.suit), value)
    return el
  }

  const label = document.createElement('span')
  label.className = 'card__label'
  label.textContent = card.kind === 'mage' ? 'Magier' : 'Narr'

  const glyph = document.createElement('span')
  glyph.className = 'card__glyph'
  glyph.textContent = card.kind === 'mage' ? '★' : '?'

  el.title = card.kind === 'mage' ? 'Magier — gewinnt jeden Stich' : 'Narr — gewinnt nie'
  el.append(glyph, label)
  return el
}

const board = document.querySelector<HTMLElement>('#deck')
const status = document.querySelector<HTMLElement>('#status')
const shuffleButton = document.querySelector<HTMLButtonElement>('#shuffle')
const resetButton = document.querySelector<HTMLButtonElement>('#reset')

if (!board || !status || !shuffleButton || !resetButton) {
  throw new Error('Grundgeruest der Seite fehlt — index.html passt nicht zu main.ts')
}

// Bewusst eine const-Pfeilfunktion statt einer function-Deklaration:
// Deklarationen werden hochgezogen, deshalb behaelt TypeScript die
// Nicht-null-Verengung von oben darin nicht bei.
const draw = (cards: readonly Card[], note: string): void => {
  board.replaceChildren(...cards.map(renderCard))
  status.textContent = `${cards.length} von ${DECK_SIZE} Karten · ${note}`
}

// Der Startwert bleibt intern (Entscheidung 31) und taucht in der
// Oberflaeche nicht auf. Hier dient er nur dazu, das Mischen ueberhaupt
// vorzufuehren.
let seed = 1
shuffleButton.addEventListener('click', () => {
  seed += 1
  draw(shuffle(deck, createRng(seed)), 'gemischt')
})

resetButton.addEventListener('click', () => {
  draw(deck, 'ungemischt, in Deckreihenfolge')
})

draw(deck, 'ungemischt, in Deckreihenfolge')
