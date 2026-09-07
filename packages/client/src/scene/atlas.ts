/**
 * Die Kartenmotive als eine einzige Textur.
 *
 * In der Szene ist jede Karte ein Koerper mit einer Textur. Waeren das 61
 * einzelne Texturen, muesste die Grafikkarte je Bild 61-mal umschalten -- der
 * teuerste Posten, den eine Szene aus lauter kleinen Flaechen haben kann. Es
 * gibt deshalb eine gemeinsame Bildtafel, und jede Karte holt sich daraus
 * ihren Ausschnitt (Stufe 2 in docs/08-TISCHANSICHT.md).
 *
 * Gebaut wird die Tafel von `tools/prepare-cards.mjs`, ihre Aufteilung steht
 * in `cardart.generated.ts`.
 *
 * Fehlt ein Motiv, wird es hier typografisch nachgezeichnet und in eine
 * eigene Tafel gesetzt. Ein unvollstaendiges Kartenset macht also weiterhin
 * keine Partie unspielbar -- dieselbe Zusage wie in `cardview.ts`, nur eine
 * Ebene tiefer.
 */

import {
  ClampToEdgeWrapping,
  CanvasTexture,
  Color,
  LinearMipmapLinearFilter,
  LinearFilter,
  SRGBColorSpace,
  Texture,
} from 'three'
import { createDeck } from '@runecall/engine'
import type { Card, Suit } from '@runecall/engine'

import {
  CARD_ATLAS,
  CARD_ATLAS_CELL,
  CARD_ATLAS_COLUMNS,
  CARD_FRAMES,
} from '../cardart.generated.ts'
import { SUIT_STYLES } from '../runes.ts'

/** Der Ausschnitt einer Karte auf der Tafel, schon als Texturkoordinaten. */
export type CardFace = {
  readonly u0: number
  readonly u1: number
  /** `v0` ist die Unterkante, `v1` die Oberkante -- Texturen zaehlen von unten. */
  readonly v0: number
  readonly v1: number
}

export type CardArt = {
  readonly face: CardFace
  /** Farbe der vier schmalen Kanten des Kartenkoerpers. */
  readonly edge: Color
}

export type CardAtlas = {
  readonly texture: Texture
  readonly back: CardArt
  art(id: string): CardArt
}

const PITCH_X = CARD_ATLAS_CELL.width + 2 * CARD_ATLAS_CELL.gutter
const PITCH_Y = CARD_ATLAS_CELL.height + 2 * CARD_ATLAS_CELL.gutter

/** Alles, was eine Textur braucht: die Rueckseite und jede Karte des Decks. */
function neededIds(): string[] {
  return ['back', ...createDeck().map((card) => card.id)]
}

/**
 * Laedt die Bildtafel und meldet, wo welche Karte darauf liegt.
 *
 * `anisotropy` kommt vom Renderer. Karten liegen flach auf dem Tisch und
 * werden dadurch stark verkuerzt gesehen; ohne anisotrope Filterung
 * verschmieren gerade die weit entfernten zu Brei.
 */
export async function loadCardAtlas(anisotropy: number): Promise<CardAtlas> {
  const ids = neededIds()
  const missing = ids.filter((id) => CARD_FRAMES[id] === undefined)
  const image = await loadImage(CARD_ATLAS).catch(() => null)

  const built =
    image !== null && missing.length === 0
      ? fromSheet(image)
      : await drawFallbackSheet(ids, image)

  built.texture.colorSpace = SRGBColorSpace
  built.texture.anisotropy = anisotropy
  built.texture.magFilter = LinearFilter
  built.texture.minFilter = LinearMipmapLinearFilter
  built.texture.wrapS = ClampToEdgeWrapping
  built.texture.wrapT = ClampToEdgeWrapping
  built.texture.generateMipmaps = true
  built.texture.needsUpdate = true

  const fallbackArt = built.entries.get('back') ?? {
    face: { u0: 0, u1: 1, v0: 0, v1: 1 },
    edge: new Color('#2a2333'),
  }

  return {
    texture: built.texture,
    back: fallbackArt,
    art: (id) => built.entries.get(id) ?? fallbackArt,
  }
}

type Built = { texture: Texture; entries: Map<string, CardArt> }

/** Der Normalfall: die fertige Tafel wird unveraendert uebernommen. */
function fromSheet(image: HTMLImageElement): Built {
  const entries = new Map<string, CardArt>()

  for (const [id, frame] of Object.entries(CARD_FRAMES)) {
    entries.set(id, {
      face: cellFace(frame.col, frame.row, image.width, image.height),
      edge: new Color(frame.edge),
    })
  }

  const texture = new Texture(image)
  return { texture, entries }
}

/**
 * Der Notfall: eine eigene Tafel, gemischt aus dem, was vorliegt, und dem,
 * was der Client selbst zeichnet.
 *
 * Sie hat dieselbe Zellgroesse wie die gelieferte, nur so viele Zeilen wie
 * noetig -- die gelieferte Tafel hat fuer fehlende Karten keinen Platz.
 */
async function drawFallbackSheet(ids: string[], source: HTMLImageElement | null): Promise<Built> {
  const columns = CARD_ATLAS_COLUMNS
  const rows = Math.ceil(ids.length / columns)

  const canvas = document.createElement('canvas')
  canvas.width = columns * PITCH_X
  canvas.height = rows * PITCH_Y

  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('Kein 2D-Kontext fuer die Kartentafel')

  const byId = new Map(createDeck().map((card) => [card.id, card] as const))
  const entries = new Map<string, CardArt>()

  ids.forEach((id, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    const x = col * PITCH_X + CARD_ATLAS_CELL.gutter
    const y = row * PITCH_Y + CARD_ATLAS_CELL.gutter

    const frame = CARD_FRAMES[id]
    let edge: string

    if (frame !== undefined && source !== null) {
      ctx.drawImage(
        source,
        frame.col * PITCH_X + CARD_ATLAS_CELL.gutter,
        frame.row * PITCH_Y + CARD_ATLAS_CELL.gutter,
        CARD_ATLAS_CELL.width,
        CARD_ATLAS_CELL.height,
        x,
        y,
        CARD_ATLAS_CELL.width,
        CARD_ATLAS_CELL.height,
      )
      edge = frame.edge
    } else {
      ctx.save()
      ctx.translate(x, y)
      edge = id === 'back' ? drawBack(ctx) : drawTypographic(ctx, byId.get(id) ?? null)
      ctx.restore()
    }

    entries.set(id, {
      face: cellFace(col, row, canvas.width, canvas.height),
      edge: new Color(edge),
    })
  })

  return { texture: new CanvasTexture(canvas), entries }
}

/**
 * Rechnet Zelle zu Texturkoordinaten um.
 *
 * Bilder zaehlen ihre Zeilen von oben, Texturen ihre Hoehe von unten -- die
 * Umkehrung passiert hier, damit sie sonst nirgends mehr auftaucht.
 */
function cellFace(col: number, row: number, width: number, height: number): CardFace {
  const left = col * PITCH_X + CARD_ATLAS_CELL.gutter
  const top = row * PITCH_Y + CARD_ATLAS_CELL.gutter

  return {
    u0: left / width,
    u1: (left + CARD_ATLAS_CELL.width) / width,
    v0: 1 - (top + CARD_ATLAS_CELL.height) / height,
    v1: 1 - top / height,
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error(`Bildtafel ${src} fehlt`)))
    image.src = src
  })
}

/* ------------------------------------------------------------------ *
 * Typografische Ersatzkarten
 * ------------------------------------------------------------------ */

const W = CARD_ATLAS_CELL.width
const H = CARD_ATLAS_CELL.height
const RADIUS = 26

const SUIT_INK: Record<Suit, string> = {
  red: '#c8402f',
  yellow: '#bb8409',
  green: '#2d8a4c',
  blue: '#3366ba',
}

function cardShape(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath()
  ctx.roundRect(4, 4, W - 8, H - 8, RADIUS)
}

/** Zeichnet eine Karte ohne Motiv und meldet ihre Randfarbe zurueck. */
function drawTypographic(ctx: CanvasRenderingContext2D, card: Card | null): string {
  if (card === null) return drawBack(ctx)

  if (card.kind === 'pip') {
    const ink = SUIT_INK[card.suit]

    cardShape(ctx)
    ctx.fillStyle = '#fbf7ee'
    ctx.fill()
    ctx.lineWidth = 8
    ctx.strokeStyle = ink
    ctx.stroke()

    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '800 132px system-ui, sans-serif'
    ctx.fillText(String(card.value), W / 2, H * 0.44)

    ctx.font = '700 40px system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(String(card.value), 28, 24)

    drawRune(ctx, card.suit, W / 2, H * 0.74, 72)
    return ink
  }

  const mage = card.kind === 'mage'
  const gradient = ctx.createLinearGradient(0, 0, W, H)
  gradient.addColorStop(0, mage ? '#8a5cf0' : '#ffe9a8')
  gradient.addColorStop(1, mage ? '#4b23a8' : '#dfa62a')

  cardShape(ctx)
  ctx.fillStyle = gradient
  ctx.fill()
  ctx.lineWidth = 8
  ctx.strokeStyle = mage ? '#37187d' : '#96690f'
  ctx.stroke()

  ctx.fillStyle = mage ? '#ffffff' : '#4a370f'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '700 150px system-ui, sans-serif'
  ctx.fillText(mage ? '★' : '?', W / 2, H * 0.42)

  ctx.font = '800 34px system-ui, sans-serif'
  ctx.fillText(mage ? 'MAGIER' : 'NARR', W / 2, H * 0.78)

  return mage ? '#37187d' : '#96690f'
}

/** Die Rueckseite, falls auch sie fehlt: das Rautenmuster des flachen Aufbaus. */
function drawBack(ctx: CanvasRenderingContext2D): string {
  cardShape(ctx)
  ctx.fillStyle = '#241d33'
  ctx.fill()
  ctx.lineWidth = 8
  ctx.strokeStyle = '#6d3fd1'
  ctx.stroke()

  ctx.save()
  cardShape(ctx)
  ctx.clip()
  ctx.strokeStyle = 'rgba(150, 110, 235, 0.55)'
  ctx.lineWidth = 6
  for (let offset = -H; offset < W + H; offset += 26) {
    ctx.beginPath()
    ctx.moveTo(offset, 0)
    ctx.lineTo(offset + H, H)
    ctx.stroke()
  }
  ctx.restore()

  return '#2a2333'
}

/**
 * Die Rune einer Farbe, aus denselben Pfaddaten wie im flachen Aufbau.
 *
 * Eine zweite Zeichnung waere eine zweite Wahrheit -- die Rune muss auf der
 * Karte dieselbe sein wie in der Bedienoberflaeche (Entscheidung 24).
 */
function drawRune(ctx: CanvasRenderingContext2D, suit: Suit, cx: number, cy: number, size: number): void {
  const scale = size / 16

  ctx.save()
  ctx.translate(cx - 5 * scale, cy - 8 * scale)
  ctx.scale(scale, scale)
  ctx.strokeStyle = SUIT_INK[suit]
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke(new Path2D(SUIT_STYLES[suit].runePath))
  ctx.restore()
}
