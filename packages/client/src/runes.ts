/**
 * Darstellung der vier Farben.
 *
 * Hier -- nicht in der Engine -- liegt, wie eine Farbe *aussieht*. Die Engine
 * kennt nur `Suit`; ob daraus ein rotes Feld mit einer Kenaz-Rune wird, ist
 * Sache des Clients.
 *
 * Jede Farbe traegt zusaetzlich zur Farbe ein eigenes Runenzeichen
 * (Entscheidung 24). Damit bleiben die vier Farben auch fuer rot-gruen-blinde
 * Spieler unterscheidbar -- und der Name Runecall traegt visuell.
 *
 * Die Runen sind als Linienzuege gezeichnet statt als Unicode-Zeichen: so
 * rendern sie auf jedem Geraet gleich, unabhaengig davon, ob eine
 * Schriftart den Runenblock abdeckt.
 */

import type { Suit } from '@runecall/engine'

export type SuitStyle = {
  /** Anzeigename auf Deutsch. */
  readonly label: string
  /** Name der Rune -- taucht in Tooltips und der Regelhilfe auf. */
  readonly runeName: string
  /** Pfaddaten fuer ein SVG mit viewBox "0 0 10 16". */
  readonly runePath: string
}

export const SUIT_STYLES: Record<Suit, SuitStyle> = {
  // Kenaz -- die Fackel. Feuer, also Rot.
  red: { label: 'Rot', runeName: 'Kenaz', runePath: 'M7.5 2 L2.5 8 L7.5 14' },
  // Sowilo -- die Sonne. Gelb.
  yellow: { label: 'Gelb', runeName: 'Sowilo', runePath: 'M7.5 2 L3 6 L7 10 L2.5 14' },
  // Berkano -- die Birke. Gruen.
  green: {
    label: 'Grün',
    runeName: 'Berkano',
    runePath: 'M2.5 2 L2.5 14 M2.5 2 L7.5 5 L2.5 8 M2.5 8 L7.5 11 L2.5 14',
  },
  // Laguz -- das Wasser. Blau.
  blue: { label: 'Blau', runeName: 'Laguz', runePath: 'M3 2 L3 14 M3 2 L7.5 6' },
}

/** Baut das SVG-Element fuer die Rune einer Farbe. */
export function createRune(suit: Suit): SVGSVGElement {
  const style = SUIT_STYLES[suit]
  const ns = 'http://www.w3.org/2000/svg'

  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', '0 0 10 16')
  svg.setAttribute('class', 'rune')
  svg.setAttribute('aria-hidden', 'true')

  const path = document.createElementNS(ns, 'path')
  path.setAttribute('d', style.runePath)
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '1.6')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')

  svg.append(path)
  return svg
}
