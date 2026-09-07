/**
 * Erzeugt von tools/prepare-cards.mjs -- nicht von Hand ändern.
 *
 * Zweierlei steht hier: das Verzeichnis der einzelnen Kartenbilder, und die
 * Aufteilung der gemeinsamen Bildtafel, aus der die Tischansicht ihre
 * Ausschnitte holt. Karten, die hier fehlen, zeichnet der Client
 * typografisch.
 */

export const CARD_ART_SET = 'standard'

export const CARD_ART: Readonly<Record<string, string>> = {
  'back': '/cards/standard/back.webp',
  'blue-1': '/cards/standard/blue-1.webp',
  'blue-10': '/cards/standard/blue-10.webp',
  'blue-11': '/cards/standard/blue-11.webp',
  'blue-12': '/cards/standard/blue-12.webp',
  'blue-13': '/cards/standard/blue-13.webp',
  'blue-2': '/cards/standard/blue-2.webp',
  'blue-3': '/cards/standard/blue-3.webp',
  'blue-4': '/cards/standard/blue-4.webp',
  'blue-5': '/cards/standard/blue-5.webp',
  'blue-6': '/cards/standard/blue-6.webp',
  'blue-7': '/cards/standard/blue-7.webp',
  'blue-8': '/cards/standard/blue-8.webp',
  'blue-9': '/cards/standard/blue-9.webp',
  'green-1': '/cards/standard/green-1.webp',
  'green-10': '/cards/standard/green-10.webp',
  'green-11': '/cards/standard/green-11.webp',
  'green-12': '/cards/standard/green-12.webp',
  'green-13': '/cards/standard/green-13.webp',
  'green-2': '/cards/standard/green-2.webp',
  'green-3': '/cards/standard/green-3.webp',
  'green-4': '/cards/standard/green-4.webp',
  'green-5': '/cards/standard/green-5.webp',
  'green-6': '/cards/standard/green-6.webp',
  'green-7': '/cards/standard/green-7.webp',
  'green-8': '/cards/standard/green-8.webp',
  'green-9': '/cards/standard/green-9.webp',
  'jester-1': '/cards/standard/jester-1.webp',
  'jester-2': '/cards/standard/jester-2.webp',
  'jester-3': '/cards/standard/jester-3.webp',
  'jester-4': '/cards/standard/jester-4.webp',
  'mage-1': '/cards/standard/mage-1.webp',
  'mage-2': '/cards/standard/mage-2.webp',
  'mage-3': '/cards/standard/mage-3.webp',
  'mage-4': '/cards/standard/mage-4.webp',
  'red-1': '/cards/standard/red-1.webp',
  'red-10': '/cards/standard/red-10.webp',
  'red-11': '/cards/standard/red-11.webp',
  'red-12': '/cards/standard/red-12.webp',
  'red-13': '/cards/standard/red-13.webp',
  'red-2': '/cards/standard/red-2.webp',
  'red-3': '/cards/standard/red-3.webp',
  'red-4': '/cards/standard/red-4.webp',
  'red-5': '/cards/standard/red-5.webp',
  'red-6': '/cards/standard/red-6.webp',
  'red-7': '/cards/standard/red-7.webp',
  'red-8': '/cards/standard/red-8.webp',
  'red-9': '/cards/standard/red-9.webp',
  'yellow-1': '/cards/standard/yellow-1.webp',
  'yellow-10': '/cards/standard/yellow-10.webp',
  'yellow-11': '/cards/standard/yellow-11.webp',
  'yellow-12': '/cards/standard/yellow-12.webp',
  'yellow-13': '/cards/standard/yellow-13.webp',
  'yellow-2': '/cards/standard/yellow-2.webp',
  'yellow-3': '/cards/standard/yellow-3.webp',
  'yellow-4': '/cards/standard/yellow-4.webp',
  'yellow-5': '/cards/standard/yellow-5.webp',
  'yellow-6': '/cards/standard/yellow-6.webp',
  'yellow-7': '/cards/standard/yellow-7.webp',
  'yellow-8': '/cards/standard/yellow-8.webp',
  'yellow-9': '/cards/standard/yellow-9.webp',
}

/** Die gemeinsame Bildtafel und ihr Raster. */
export const CARD_ATLAS = '/cards/standard/atlas.webp'
export const CARD_ATLAS_COLUMNS = 8
export const CARD_ATLAS_ROWS = 8
export const CARD_ATLAS_CELL = { width: 256, height: 400, gutter: 4 } as const

export type CardFrame = {
  /** Spalte und Zeile der Karte auf der Tafel. */
  readonly col: number
  readonly row: number
  /** Mittlere Randfarbe des Motivs -- faerbt die Kanten des Kartenkoerpers. */
  readonly edge: string
}

export const CARD_FRAMES: Readonly<Record<string, CardFrame>> = {
  'back': { col: 0, row: 0, edge: '#e1dfe7' },
  'blue-1': { col: 1, row: 0, edge: '#c2cbd6' },
  'blue-10': { col: 2, row: 0, edge: '#c7d1df' },
  'blue-11': { col: 3, row: 0, edge: '#c4ceda' },
  'blue-12': { col: 4, row: 0, edge: '#c4cdd7' },
  'blue-13': { col: 5, row: 0, edge: '#c5ceda' },
  'blue-2': { col: 6, row: 0, edge: '#c2cbd5' },
  'blue-3': { col: 7, row: 0, edge: '#c1cbd9' },
  'blue-4': { col: 0, row: 1, edge: '#c1cbd9' },
  'blue-5': { col: 1, row: 1, edge: '#c4cdd9' },
  'blue-6': { col: 2, row: 1, edge: '#c7d0dd' },
  'blue-7': { col: 3, row: 1, edge: '#c5cfdb' },
  'blue-8': { col: 4, row: 1, edge: '#c3ccd8' },
  'blue-9': { col: 5, row: 1, edge: '#c9d3e1' },
  'green-1': { col: 6, row: 1, edge: '#cdd8cc' },
  'green-10': { col: 7, row: 1, edge: '#d0dacf' },
  'green-11': { col: 0, row: 2, edge: '#d2dbd2' },
  'green-12': { col: 1, row: 2, edge: '#d1dad1' },
  'green-13': { col: 2, row: 2, edge: '#ced8cd' },
  'green-2': { col: 3, row: 2, edge: '#cdd8cc' },
  'green-3': { col: 4, row: 2, edge: '#cbd5ca' },
  'green-4': { col: 5, row: 2, edge: '#c9d2c8' },
  'green-5': { col: 6, row: 2, edge: '#ced7cd' },
  'green-6': { col: 7, row: 2, edge: '#cdd7cc' },
  'green-7': { col: 0, row: 3, edge: '#cbd4c9' },
  'green-8': { col: 1, row: 3, edge: '#cdd6cb' },
  'green-9': { col: 2, row: 3, edge: '#d0dacf' },
  'jester-1': { col: 3, row: 3, edge: '#edc3b4' },
  'jester-2': { col: 4, row: 3, edge: '#e4d29b' },
  'jester-3': { col: 5, row: 3, edge: '#bfd0b7' },
  'jester-4': { col: 6, row: 3, edge: '#bcd2e7' },
  'mage-1': { col: 7, row: 3, edge: '#ecc2b3' },
  'mage-2': { col: 0, row: 4, edge: '#e1d099' },
  'mage-3': { col: 1, row: 4, edge: '#c5d8be' },
  'mage-4': { col: 2, row: 4, edge: '#b5cade' },
  'red-1': { col: 3, row: 4, edge: '#d2bebb' },
  'red-10': { col: 4, row: 4, edge: '#d9c7c0' },
  'red-11': { col: 5, row: 4, edge: '#dbc7c0' },
  'red-12': { col: 6, row: 4, edge: '#dbc8c0' },
  'red-13': { col: 7, row: 4, edge: '#dcc8c2' },
  'red-2': { col: 0, row: 5, edge: '#d1bebb' },
  'red-3': { col: 1, row: 5, edge: '#d0bcb6' },
  'red-4': { col: 2, row: 5, edge: '#d0bbb6' },
  'red-5': { col: 3, row: 5, edge: '#c3aba6' },
  'red-6': { col: 4, row: 5, edge: '#c1aaa5' },
  'red-7': { col: 5, row: 5, edge: '#d0b7b3' },
  'red-8': { col: 6, row: 5, edge: '#d0b8b3' },
  'red-9': { col: 7, row: 5, edge: '#d9c8c1' },
  'yellow-1': { col: 0, row: 6, edge: '#d6ceba' },
  'yellow-10': { col: 1, row: 6, edge: '#d6cbb6' },
  'yellow-11': { col: 2, row: 6, edge: '#d7cfba' },
  'yellow-12': { col: 3, row: 6, edge: '#d7ceb9' },
  'yellow-13': { col: 4, row: 6, edge: '#d9cfb9' },
  'yellow-2': { col: 5, row: 6, edge: '#d7cfba' },
  'yellow-3': { col: 6, row: 6, edge: '#d6ceb7' },
  'yellow-4': { col: 7, row: 6, edge: '#d4cdb7' },
  'yellow-5': { col: 0, row: 7, edge: '#d7cfbc' },
  'yellow-6': { col: 1, row: 7, edge: '#d6cfbc' },
  'yellow-7': { col: 2, row: 7, edge: '#dbd0b7' },
  'yellow-8': { col: 3, row: 7, edge: '#d1c6ae' },
  'yellow-9': { col: 4, row: 7, edge: '#d6cbb5' },
}
