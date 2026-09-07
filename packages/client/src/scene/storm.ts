/**
 * Der Kartensturm.
 *
 * Um den Tisch treibt ein Wirbel kleiner Karten: teils Rueckseiten, teils
 * Motive, alle blass und langsam. Sie gehoeren zu niemandem und tun nichts --
 * sie sind Kulisse, wie die Lichtpunkte, nur groesser und mit Wiedererkennung.
 *
 * Drei Entscheidungen stecken darin:
 *
 * - **Alles in einer einzigen Geometrie.** Fuenfzig einzelne Karten waeren
 *   fuenfzig Zeichenbefehle je Bild. Hier liegen alle Ecken in einem Puffer,
 *   der Bild fuer Bild neu beschrieben wird: zweihundert Punkte umrechnen ist
 *   billiger als fuenfzig Objekte durch die Grafikkarte zu schicken.
 * - **Sie liegen im Raum, nicht darueber.** Anders als die Spielkarten
 *   pruefen sie die Tiefe: Was hinter dem Tisch vorbeitreibt, verschwindet
 *   auch dahinter. Genau das macht aus einem Muster einen Raum.
 * - **Sie halten Abstand.** Ihre Bahnen liegen ausserhalb der Tischkante. Ein
 *   Wirbel, der ueber die Spielflaeche zieht, waere kein Schmuck mehr,
 *   sondern eine Stoerung.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three'
import { createDeck } from '@runecall/engine'

import type { CardAtlas } from './atlas.ts'
import { TABLE_RX } from './room.ts'
import type { Stage } from './stage.ts'

/** Wie viele Karten der Wirbel traegt. */
const COUNT = 44

/**
 * Groesse einer treibenden Karte, halbe Breite und halbe Hoehe in Weltmass.
 *
 * Groesser als frueher, weil die Bahnen weiter draussen liegen: Aus der
 * doppelten Entfernung waere dieselbe Karte im Bild nur noch halb so gross.
 */
const HALF_W = 0.42
const HALF_H = 0.66

/**
 * Der Ring, in dem sie treiben.
 *
 * Weit ausserhalb der Tischkante: Der Wirbel gehoert zum Raum, nicht zum
 * Spiel. Kommt er dem Tisch nahe, sieht es aus, als gehoerten die Karten
 * dazu -- und der Blick sucht dort, wo nichts zu finden ist.
 */
const NEAR = TABLE_RX + 4.2
const FAR = TABLE_RX + 12

/** Wie hoch und wie tief. Unter dem Tisch ist Platz, dort ist nichts. */
const LOW = -2.6
const HIGH = 8.4

/**
 * Ab wo eine Karte zu nah ist.
 *
 * Die Bahnen fuehren auch an der Kamera vorbei. Eine Karte, die einen Meter
 * vor dem Auge vorbeizieht, fuellt den halben Bildschirm und reisst den Blick
 * vom Tisch weg. Deshalb schrumpfen sie auf dem letzten Stueck weg, statt
 * hindurchzufliegen -- man sieht nicht, dass sie gehen, nur dass keine da ist.
 */
const FADE_FROM = 8.5
const FADE_TO = 5.5

export type CardStorm = {
  readonly mesh: Mesh
  update(dt: number): void
  dispose(): void
}

type Flake = {
  /** Lage auf der Bahn. */
  angle: number
  turn: number
  radiusX: number
  radiusZ: number
  height: number
  rise: number
  /** Drehung in der Bildebene und Taumeln um die Hochachse. */
  spin: number
  spinTurn: number
  tumble: number
  tumbleTurn: number
  /** Wie weit die Karte um ihre Bahn herum schwankt. */
  swayPhase: number
  swayTurn: number
}

export function createCardStorm(stage: Stage, atlas: CardAtlas): CardStorm {
  const deck = createDeck()

  const positions = new Float32Array(COUNT * 4 * 3)
  const uvs = new Float32Array(COUNT * 4 * 2)
  const colours = new Float32Array(COUNT * 4 * 3)
  const index = new Uint16Array(COUNT * 6)

  const flakes: Flake[] = []
  const tone = new Color()

  for (let i = 0; i < COUNT; i++) {
    // Ueberwiegend Motive. Seit die Karten dem Hintergrund zugerechnet werden
    // statt darauf zu liegen, tragen die dunklen Rueckseiten kaum noch etwas
    // bei -- was dunkel ist, verschwindet beim Aufaddieren fast ganz.
    const card = deck[Math.floor(Math.random() * deck.length)]
    const art = Math.random() < 0.25 || card === undefined ? atlas.back : atlas.art(card.id)

    const corners: readonly (readonly [number, number])[] = [
      [art.face.u0, art.face.v0],
      [art.face.u1, art.face.v0],
      [art.face.u1, art.face.v1],
      [art.face.u0, art.face.v1],
    ]

    // Weiter aussen heisst blasser: Der Wirbel soll nach hinten verschwinden
    // und nicht als Band um den Tisch stehen.
    const depth = Math.random()
    const brightness = 0.85 - depth * 0.45
    tone.setRGB(brightness, brightness * 0.94, brightness * 1.04)

    for (let corner = 0; corner < 4; corner++) {
      const at = corners[corner] ?? [0, 0]
      uvs[(i * 4 + corner) * 2] = at[0]
      uvs[(i * 4 + corner) * 2 + 1] = at[1]
      colours[(i * 4 + corner) * 3] = tone.r
      colours[(i * 4 + corner) * 3 + 1] = tone.g
      colours[(i * 4 + corner) * 3 + 2] = tone.b
    }

    const base = i * 4
    index.set([base, base + 1, base + 2, base, base + 2, base + 3], i * 6)

    const radius = NEAR + (FAR - NEAR) * depth
    flakes.push({
      angle: Math.random() * Math.PI * 2,
      // Weiter aussen zieht es langsamer vorbei. Gleiche Winkelgeschwindigkeit
      // fuer alle liesse den Wirbel wie eine starre Scheibe wirken.
      turn: (0.055 + Math.random() * 0.075) * (1 - depth * 0.45),
      radiusX: radius,
      radiusZ: radius * 0.78,
      height: LOW + Math.random() * (HIGH - LOW),
      rise: 0.12 + Math.random() * 0.4,
      spin: Math.random() * Math.PI * 2,
      spinTurn: (Math.random() - 0.5) * 0.5,
      tumble: Math.random() * Math.PI * 2,
      tumbleTurn: 0.18 + Math.random() * 0.5,
      swayPhase: Math.random() * Math.PI * 2,
      swayTurn: 0.2 + Math.random() * 0.4,
    })
  }

  const geometry = new BufferGeometry()
  const position = new BufferAttribute(positions, 3)
  position.setUsage(DynamicDrawUsage) // wird jedes Bild neu beschrieben
  geometry.setAttribute('position', position)
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new BufferAttribute(colours, 3))
  geometry.setIndex(new BufferAttribute(index, 1))

  /**
   * Aufaddiert statt daruebergelegt.
   *
   * Eine treibende Karte soll kein Aufkleber auf der Buehne sein, sondern
   * etwas, das darin leuchtet. Beim Aufaddieren geht ihre Farbe in die des
   * Hintergrunds ueber: Wo sie hell ist, glimmt sie; wo sie dunkel ist,
   * bleibt der Hintergrund stehen. Deshalb tragen die Rueckseiten hier auch
   * kaum noch etwas bei -- und deshalb sind es ueberwiegend Motive.
   *
   * `alphaTest` bleibt: Die runden Ecken der Motive sollen nicht als
   * schwache Rechtecke mitleuchten.
   */
  const material = new MeshBasicMaterial({
    map: atlas.texture,
    vertexColors: true,
    side: DoubleSide,
    transparent: true,
    opacity: 0.5,
    alphaTest: 0.25,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })

  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  // Vor dem Raum, hinter allem, was gespielt wird.
  mesh.renderOrder = -1

  /* --- Bewegung ----------------------------------------------------- */

  // Die Karten stehen zur Kamera, aber jede in ihrer eigenen Drehung. Die
  // beiden Richtungen der Bildebene kommen deshalb einmal aus der Kamera und
  // werden je Karte nur noch verdreht.
  const right = new Vector3(1, 0, 0).applyQuaternion(stage.camera.quaternion)
  const up = new Vector3(0, 1, 0).applyQuaternion(stage.camera.quaternion)

  const eye = stage.camera.position
  const across = new Vector3()
  const along = new Vector3()
  const middle = new Vector3()

  function write(): void {
    flakes.forEach((flake, i) => {
      const sway = Math.sin(flake.swayPhase) * 0.5
      middle.set(
        Math.sin(flake.angle) * (flake.radiusX + sway),
        flake.height,
        Math.cos(flake.angle) * (flake.radiusZ + sway),
      )

      // Das Taumeln staucht die Breite, als drehte sich die Karte um ihre
      // Hochachse. Ganz auf null geht sie nicht -- eine Karte, die zur Kante
      // wird, verschwindet fuer einen Augenblick ganz.
      const squash = Math.max(0.14, Math.abs(Math.cos(flake.tumble)))
      const cos = Math.cos(flake.spin)
      const sin = Math.sin(flake.spin)

      const far = middle.distanceTo(eye)
      const near = Math.min(1, Math.max(0, (far - FADE_TO) / (FADE_FROM - FADE_TO)))
      const width = HALF_W * squash * near
      const height = HALF_H * near

      across.copy(right).multiplyScalar(cos).addScaledVector(up, sin).multiplyScalar(width)
      along.copy(up).multiplyScalar(cos).addScaledVector(right, -sin).multiplyScalar(height)

      for (let corner = 0; corner < 4; corner++) {
        const sideways = corner === 0 || corner === 3 ? -1 : 1
        const upwards = corner === 0 || corner === 1 ? -1 : 1
        const at = (i * 4 + corner) * 3

        positions[at] = middle.x + across.x * sideways + along.x * upwards
        positions[at + 1] = middle.y + across.y * sideways + along.y * upwards
        positions[at + 2] = middle.z + across.z * sideways + along.z * upwards
      }
    })

    position.needsUpdate = true
  }

  write()

  return {
    mesh,

    update(dt) {
      for (const flake of flakes) {
        flake.angle += flake.turn * dt
        flake.spin += flake.spinTurn * dt
        flake.tumble += flake.tumbleTurn * dt
        flake.swayPhase += flake.swayTurn * dt

        flake.height += flake.rise * dt
        if (flake.height > HIGH) flake.height = LOW
      }
      write()
    },

    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
