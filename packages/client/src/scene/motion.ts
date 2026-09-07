/**
 * Bewegung nach Zeit.
 *
 * Hier stand einmal eine Feder: Ein Ziel wurde gesetzt, der Wert lief ihm
 * hinterher, schoss darueber hinaus und pendelte sich ein. Das gab jeder
 * Bewegung Gewicht -- und jeder Bewegung eine eigene, nicht vorhersagbare
 * Dauer. Genau daran lag das Zittern: Ordnete sich der Faecher neu, waehrend
 * eine Feder noch schwang, bekam sie mitten im Lauf ein neues Ziel und fing
 * von einer zufaelligen Geschwindigkeit aus neu an.
 *
 * Jetzt hat jede Bewegung eine feste Dauer und eine feste Kurve. Sie beginnt,
 * sie endet, und dazwischen laeuft sie immer gleich ab. Das ist weniger
 * Physik und mehr Zeichentrick -- und genau die Art Bewegung, die man aus
 * flachen Kartenspielen kennt.
 */

export const clamp = (value: number, low: number, high: number): number =>
  value < low ? low : value > high ? high : value

export const lerp = (from: number, to: number, t: number): number => from + (to - from) * t

/** Anlauf und Auslauf -- der ruhige Standardweg. */
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

/** Schneller Start, sanftes Ende -- was gelegt oder geworfen wird. */
export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3

/**
 * Ende mit einem kurzen Ueberschwinger.
 *
 * Das ist der letzte Rest Gewicht, den eine Karte behaelt: Sie kommt eine
 * Spur zu gross an und geht dann auf ihr Mass zurueck. Ein Aufsetzen, das man
 * sieht, ohne dass etwas nachwackelt.
 */
export function easeOutBack(t: number): number {
  const overshoot = 1.34
  return 1 + (overshoot + 1) * (t - 1) ** 3 + overshoot * (t - 1) ** 2
}

/**
 * Hoehe ueber der geraden Verbindung, als Bogen von 0 auf 0.
 *
 * Eine gelegte Karte faehrt nicht schnurgerade in die Mitte, sondern hebt
 * sich unterwegs ein wenig. Der Bogen ist klein -- er soll die Bewegung
 * lesbar machen, nicht einen Wurf nachstellen.
 */
export const arcHeight = (t: number): number => Math.sin(Math.PI * clamp(t, 0, 1))

/**
 * Ein Zufallswert, der zu einer Zeichenkette gehoert.
 *
 * Der Ablagestapel soll aussehen wie hingeworfen, aber beim erneuten Zeichnen
 * desselben Zustands nicht neu wuerfeln -- sonst zuckt der Stapel bei jedem
 * Neuaufbau. Also kommt die Streuung aus der Kartenkennung.
 */
export function jitter(key: string, salt: number): number {
  let hash = 0x811c9dc5 ^ salt
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return ((hash >>> 8) % 10000) / 10000
}

/** Wie `jitter`, aber symmetrisch um Null. */
export const jitterSigned = (key: string, salt: number): number => jitter(key, salt) * 2 - 1
