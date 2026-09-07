/**
 * Die Sitzordnung.
 *
 * Du sitzt unten, die anderen verteilen sich gleichmaessig darueber. Der
 * Reihe nach im Uhrzeigersinn -- dieselbe Richtung, in der die Engine die
 * Plaetze durchzaehlt, damit "der Naechste ist dran" auch auf dem Bildschirm
 * der Naechste ist (Stufe 3).
 *
 * Gerechnet wird auf der Ellipse der Tischplatte, nicht auf einem Kreis.
 * Sonst saessen bei sechs Spielern zwei Leute neben dem Tisch.
 */

import { Vector3 } from 'three'

import { TABLE_RX, TABLE_RZ } from './room.ts'

export type Seat = {
  readonly index: number
  /** Winkel auf dem Tisch. 0 ist vorn, wachsend im Uhrzeigersinn. */
  readonly angle: number
  /** Drehung um die Hochachse, mit der etwas zu diesem Platz hin zeigt. */
  readonly facing: number
  /** Der Platz selbst, auf Tischhoehe. */
  readonly at: Vector3
}

/**
 * Wie weit die Plaetze vom Mittelpunkt entfernt sitzen, als Anteil der
 * Tischhalbachsen. Knapp innerhalb der Kante -- die Kante gehoert dem Tisch.
 */
const SEAT_INSET = 0.9

/** Baut den Ring fuer eine Spielerzahl. Platz 0 ist immer der Mensch, vorn. */
export function seatRing(playerCount: number): Seat[] {
  return Array.from({ length: playerCount }, (_, index) => {
    const angle = (index / playerCount) * Math.PI * 2
    const at = ellipse(angle, SEAT_INSET, 0)

    return {
      index,
      angle,
      // Zum Platz hin heisst: die Vorderseite zeigt vom Mittelpunkt nach
      // aussen, dorthin, wo der Spieler sitzt.
      facing: Math.atan2(at.x, at.z),
      at,
    }
  })
}

/**
 * Ein Punkt auf dem Tisch im Winkel eines Platzes.
 *
 * `reach` ist der Anteil der Halbachsen: 0 ist die Mitte, 1 die Tischkante,
 * mehr als 1 liegt daneben -- dort haengen die Namensschilder.
 */
export function ellipse(angle: number, reach: number, y: number): Vector3 {
  return new Vector3(Math.sin(angle) * TABLE_RX * reach, y, Math.cos(angle) * TABLE_RZ * reach)
}

/** Wo die Handkarten eines Mitspielers liegen. */
export const HAND_REACH = 0.8

/**
 * Wo das Namensschild eines Platzes haengt: knapp hinter der Tischkante und
 * ueber der Tischhoehe.
 *
 * Naeher an der Kante als frueher: Seit die Blaetter der Mitspieler auf der
 * Tischplatte stehen statt an ihrem Rand, sass das Schild weit weg von den
 * Karten, zu denen es gehoert.
 *
 * Die Hoehe ist der Grund, warum es nicht auf den Karten liegt. Sie musste
 * wieder steigen, als die Blaetter auf die Tischplatte rueckten: Beim
 * gegenueberliegenden Platz liegt das Schild weiter hinten als seine Karten,
 * also im Bild hoeher -- und landete damit genau auf ihnen. Beim
 * gegenueberliegenden Platz treffen sich Fächer und Schild auf dem Bildschirm
 * beinahe -- er ist am weitesten weg, und die Entfernung staucht beides
 * zusammen. Wer das Schild anhebt, schiebt es dort nach oben aus dem Fächer
 * heraus, ohne die seitlichen Plaetze aus dem Bild zu druecken.
 */
export const PLATE_REACH = 1.03
export const PLATE_HEIGHT = 1.15
