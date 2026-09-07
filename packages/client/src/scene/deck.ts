/**
 * Die Karte als Bild.
 *
 * Eine Karte in der Szene ist eine ebene Flaeche, die immer zur Kamera zeigt:
 * keine Dicke, keine Neigung, keine Woelbung. Das ist eine bewusste Abkehr vom
 * ersten Entwurf, und der Grund ist Lesbarkeit statt Sparsamkeit. Eine flach
 * auf dem Tisch liegende Karte wird perspektivisch gestaucht -- aus 384 zu 600
 * wird beinahe ein Quadrat, das Motiv verzerrt, und die Karte sieht aus, als
 * waere sie falsch zugeschnitten. Zur Kamera gedreht behaelt jedes Motiv sein
 * Seitenverhaeltnis, egal wo auf dem Tisch es liegt.
 *
 * Zwei Folgen hat das, und beide sind erwuenscht:
 *
 * - **Kein Licht auf der Karte.** Die Motive bringen ihre Farben mit; eine
 *   Beleuchtung darauf zieht sie ins Graue und die Tonwertabbildung des
 *   Renderers noch einmal. Der Werkstoff ist deshalb unbeleuchtet und von der
 *   Tonwertabbildung ausgenommen -- die Karte sieht aus wie ihre Bilddatei.
 * - **Keine Tiefenpruefung.** Karten liegen nicht *im* Raum, sie liegen
 *   *darueber*. Was vor was liegt, entscheidet die Reihenfolge, die der Tisch
 *   vergibt (`setOrder`), nicht der Abstand zur Kamera. Damit kann eine Karte
 *   nicht mehr halb im Tisch versinken oder mit ihrem Nachbarn um denselben
 *   Bildpunkt streiten.
 *
 * Was bleibt, ist ein weicher Schatten hinter der Karte. Er ist kein
 * Schattenwurf, sondern ein dunkler Fleck, der die Karte vom Tisch abhebt --
 * dasselbe, was gezeichnete Karten in flachen Spielen tun.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  CanvasTexture,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Texture,
} from 'three'

import type { CardArt } from './atlas.ts'

/**
 * Kartenmass in Weltmassstab: eine Karte ist eine Einheit breit.
 *
 * Das Verhaeltnis ist das der Motive (384 x 600) und gilt jetzt auch auf dem
 * Bildschirm -- eine zur Kamera gedrehte Karte wird nicht mehr verzerrt.
 */
export const CARD_W = 1
export const CARD_H = 1.5625

export type CardMaterials = {
  readonly face: MeshBasicMaterial
  readonly shade: MeshBasicMaterial
  readonly mirror: MeshBasicMaterial
  dispose(): void
}

/**
 * Wie deutlich die Spiegelung an ihrer Oberkante beginnt und wie flach sie
 * liegt.
 *
 * Eine Spiegelung auf einer glaenzenden Flaeche ist nie so kraeftig wie das
 * Gespiegelte und nie so hoch: Sie wird zum Betrachter hin gestaucht. Beides
 * sind die Werte, an denen man sie als Spiegelung erkennt und nicht als zweite
 * Karte.
 */
export const MIRROR_TOP = 0.5
export const MIRROR_SQUASH = 0.62

export function createCardMaterials(atlas: Texture): CardMaterials {
  const face = new MeshBasicMaterial({
    map: atlas,
    vertexColors: true,
    side: DoubleSide,
    // Die Motive haben runde Ecken, also durchsichtige Pixel. `alphaTest`
    // schneidet sie weg -- ohne ihn saehe man um jede Karte ein schwarzes
    // Rechteck, sobald die Tiefenpruefung aus ist.
    transparent: true,
    alphaTest: 0.35,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })

  const shade = new MeshBasicMaterial({
    map: createBlobTexture(),
    color: new Color('#0b0518'),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    opacity: 0.45,
  })

  /**
   * Die Spiegelung ist ein Abbild, keine Aufhellung.
   *
   * Aufgerechnet blieben von einer dunklen Rueckseite nur ihre leuchtenden
   * Runen uebrig -- eine Handvoll bunter Striche unter der Karte, die mit
   * einer Spiegelung nichts mehr zu tun hatten. Sie wird deshalb normal
   * daruebergelegt und ueber die Deckkraft ausgeblendet: hell wie hell,
   * dunkel wie dunkel, nur schwaecher.
   *
   * Die Deckkraft steht in den Eckpunkten, nicht am Werkstoff -- nur so kann
   * sie nach unten hin auslaufen. Deshalb auch kein `alphaTest`: Der wuerde
   * die Spiegelung dort abschneiden, wo sie gerade schwach werden soll.
   */
  const mirror = new MeshBasicMaterial({
    map: atlas,
    vertexColors: true,
    side: DoubleSide,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })

  return {
    face,
    shade,
    mirror,
    dispose() {
      face.dispose()
      shade.map?.dispose()
      shade.dispose()
      mirror.dispose()
    },
  }
}

/** Der weiche Fleck hinter einer Karte, einmal in eine Textur gezeichnet. */
function createBlobTexture(): Texture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('Kein 2D-Kontext fuer den Kartenschatten')

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/* ------------------------------------------------------------------ *
 * Eine einzelne Karte
 * ------------------------------------------------------------------ */

export type CardBody = {
  readonly mesh: Mesh
  readonly shade: Mesh
  /** Die gespiegelte Kopie darunter. Standardmaessig aus. */
  readonly mirror: Mesh
  /** Welches Motiv die Karte zeigt. */
  setArt(art: CardArt): void
  /** Abdunklung der ganzen Karte, 1 ist unveraendert. */
  setTint(value: number): void
  /** Wer vor wem liegt. Groesser heisst weiter vorn; der Schatten folgt. */
  setOrder(order: number): void
  dispose(): void
}

/**
 * Die Vorlage, aus der jede Karte ihre Geometrie kopiert.
 *
 * Eine eigene braucht jede, weil die Texturkoordinaten am Eckpunkt haengen und
 * jede Karte einen anderen Ausschnitt der Bildtafel zeigt. Die unveraenderten
 * Ausgangswerte kommen aber aus einer einzigen Quelle.
 */
let template: PlaneGeometry | null = null

function templateGeometry(): PlaneGeometry {
  template ??= new PlaneGeometry(CARD_W, CARD_H)
  return template
}

export function createCardBody(materials: CardMaterials): CardBody {
  const geometry = templateGeometry().clone()

  const uv = geometry.getAttribute('uv') as BufferAttribute
  const baseUv = Float32Array.from(uv.array)
  const count = uv.count

  const colour = new BufferAttribute(new Float32Array(count * 3), 3)
  geometry.setAttribute('color', colour)

  const mesh = new Mesh(geometry, materials.face)
  mesh.frustumCulled = false

  // Die Spiegelung braucht eine eigene Geometrie: Sie zeigt zwar dasselbe
  // Motiv, aber mit einem eigenen Helligkeitsverlauf ueber die Eckpunkte --
  // und der haengt an der Geometrie.
  const mirrorGeometry = templateGeometry().clone()
  const mirrorUv = mirrorGeometry.getAttribute('uv') as BufferAttribute
  const mirrorPosition = mirrorGeometry.getAttribute('position') as BufferAttribute
  // Vier Werte je Eckpunkt: Farbe und Deckkraft. Der Verlauf steht einmal
  // fest. Gespiegelt wird ueber eine negative Hoehe, die Oberkante der Karte
  // liegt danach also unten -- dort laeuft die Spiegelung aus, an der
  // Unterkante ist sie am deutlichsten.
  const mirrorColour = new BufferAttribute(new Float32Array(count * 4), 4)
  mirrorGeometry.setAttribute('color', mirrorColour)

  for (let i = 0; i < count; i++) {
    mirrorColour.setXYZW(i, 1, 1, 1, mirrorPosition.getY(i) > 0 ? 0 : MIRROR_TOP)
  }

  const mirror = new Mesh(mirrorGeometry, materials.mirror)
  mirror.frustumCulled = false
  mirror.visible = false

  // Der Schatten bekommt einen eigenen Werkstoff, weil seine Deckkraft von
  // dieser Karte abhaengt -- eine, die vom Tisch geht, nimmt ihn mit. Die
  // Textur teilen sich alle.
  const shade = new Mesh(templateGeometry().clone(), materials.shade.clone())
  shade.frustumCulled = false

  let tint = 1

  function writeColours(): void {
    for (let i = 0; i < count; i++) colour.setXYZ(i, tint, tint, tint)
    colour.needsUpdate = true
  }

  writeColours()

  return {
    mesh,
    shade,
    mirror,

    setArt(art) {
      const { u0, u1, v0, v1 } = art.face
      for (let i = 0; i < count; i++) {
        const u = baseUv[i * 2] ?? 0
        const v = baseUv[i * 2 + 1] ?? 0
        uv.setXY(i, u0 + u * (u1 - u0), v0 + v * (v1 - v0))
        mirrorUv.setXY(i, u0 + u * (u1 - u0), v0 + v * (v1 - v0))
      }
      uv.needsUpdate = true
      mirrorUv.needsUpdate = true
    },

    setTint(value) {
      if (Math.abs(value - tint) < 0.004) return
      tint = value
      writeColours()
    },

    setOrder(order) {
      mesh.renderOrder = order
      shade.renderOrder = order - 0.5
      // Knapp unter der Karte, aber ueber deren linkem Nachbarn: Im Stapel
      // sollen sich die Spiegelungen in derselben Reihenfolge ueberlagern wie
      // die Karten darueber.
      mirror.renderOrder = order - 0.25
    },

    dispose() {
      geometry.dispose()
      mirrorGeometry.dispose()
      shade.geometry.dispose()
      if (!Array.isArray(shade.material)) shade.material.dispose()
    },
  }
}

/**
 * Die Mitte des Tisches bekommt eine Unterlage, damit der Ablagestapel nicht
 * auf dem nackten Filz klebt.
 *
 * Frueher war das ein dunkler Fleck -- der stand gut, solange der Raum dunkel
 * war. Auf einer leuchtenden Buehne wird daraus ein Loch in der Tischmitte.
 * Jetzt ist es ein heller Schein, der aufgerechnet statt daruebergelegt wird:
 * derselbe Dienst, aber in die Richtung, in die der Raum ohnehin geht.
 */
export function createPileMat(): Mesh {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('Kein 2D-Kontext fuer die Ablage')

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  gradient.addColorStop(0, 'rgba(226, 190, 255, 0.3)')
  gradient.addColorStop(0.45, 'rgba(190, 140, 246, 0.13)')
  gradient.addColorStop(1, 'rgba(160, 100, 230, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace

  const mesh = new Mesh(
    new PlaneGeometry(4.2, 4.2),
    new MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: AdditiveBlending,
      toneMapped: false,
    }),
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = 0.004
  return mesh
}
