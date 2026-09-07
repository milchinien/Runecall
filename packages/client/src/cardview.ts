/**
 * Eine Karte als DOM-Element.
 *
 * Wo ein Motiv vorliegt, wird es gezeigt. Wo keines vorliegt, zeichnet der
 * Client die Karte typografisch: grosse Zahl, Farbflaeche, Runenzeichen.
 * Beides steht nebeneinander, ohne dass das Spiel darueber stolpert -- ein
 * unvollstaendiges Kartenset macht keine Partie unspielbar, es sieht nur an
 * dieser Stelle noch nach Entwurf aus.
 *
 * Welche Motive es gibt, steht in cardart.generated.ts. Erzeugt wird das
 * von tools/prepare-cards.mjs aus dem Material unter assets/.
 *
 * Jede Farbe traegt zusaetzlich ihre Rune (Entscheidung 24) -- die Karten
 * sind damit auch ohne Farbwahrnehmung unterscheidbar.
 */

import type { Card } from '@runecall/engine'

import { CARD_ART } from './cardart.generated.ts'
import { SUIT_STYLES, createRune } from './runes.ts'

/** Lesbarer Name einer Karte, fuer Vorlesehilfen und Hinweise. */
export function cardLabel(card: Card): string {
  if (card.kind === 'mage') return 'Magier'
  if (card.kind === 'jester') return 'Narr'
  return `${SUIT_STYLES[card.suit].label} ${card.value}`
}

/** Baut die Vorderseite einer Karte. */
export function createCardElement(card: Card): HTMLElement {
  const el = document.createElement('div')
  el.className = `card card--${card.kind}`
  el.dataset['card'] = card.id
  el.setAttribute('aria-label', cardLabel(card))
  if (card.kind === 'pip') el.classList.add(`card--${card.suit}`)

  const art = CARD_ART[card.id]
  if (art !== undefined) {
    el.classList.add('card--art')
    el.append(createArt(art))
    return el
  }

  if (card.kind === 'pip') {
    const corner = document.createElement('span')
    corner.className = 'card__corner'
    corner.textContent = String(card.value)

    const value = document.createElement('span')
    value.className = 'card__value'
    value.textContent = String(card.value)

    el.append(corner, createRune(card.suit), value)
    return el
  }

  const glyph = document.createElement('span')
  glyph.className = 'card__glyph'
  glyph.textContent = card.kind === 'mage' ? '★' : '?'

  const label = document.createElement('span')
  label.className = 'card__label'
  label.textContent = card.kind === 'mage' ? 'Magier' : 'Narr'

  el.append(glyph, label)
  return el
}

/** Eine verdeckte Karte -- fuer die Haende der Mitspieler. */
export function createCardBack(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'card card--back'
  el.setAttribute('aria-hidden', 'true')

  const art = CARD_ART['back']
  if (art !== undefined) {
    el.classList.add('card--art')
    el.append(createArt(art))
  }

  return el
}

function createArt(src: string): HTMLImageElement {
  const img = document.createElement('img')
  img.className = 'card__art'
  img.src = src
  img.alt = ''
  img.draggable = false
  return img
}

/**
 * Laedt alle Motive im Hintergrund vor.
 *
 * Ohne das taucht eine Karte beim ersten Legen kurz als Luecke auf -- lokal
 * kaum sichtbar, ueber ein Mobilfunknetz sehr wohl.
 */
export function warmCardArt(): void {
  for (const src of Object.values(CARD_ART)) {
    const img = new Image()
    img.src = src
  }
}
