/**
 * Zeichenflaeche, Kamera und Taktgeber.
 *
 * Alles, was mit dem Spiel nichts zu tun hat, aber ohne das nichts geht:
 * der Renderer, die Kamera und ihre Bildaufteilung, die Bildschleife, die
 * Umrechnung von Weltpunkten auf Bildschirmpunkte (dafuer haengt die
 * Bedienoberflaeche ihre Namensschilder an die Sitze) und der Strahl, mit
 * dem ein Mausklick in der Szene etwas trifft.
 *
 * Der letzte Punkt ist der, den ein flacher Aufbau geschenkt bekam: In einer
 * Zeichenflaeche gibt es keine Elemente, auf die man klicken koennte -- es
 * gibt ein Bild. Wo der Zeiger steht, muss ausgerechnet werden.
 */

import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'

/**
 * Wohin die Kamera schaut und von wo.
 *
 * Der Blick sitzt hinter dem eigenen Platz und deutlich erhoeht: Man sieht von
 * oben auf den Tisch, nicht von der Seite darauf. Das ist der Blickwinkel, den
 * die flachen Kartenspiele haben -- er zeigt die ganze Tischflaeche, statt sie
 * zu einem schmalen Band zu stauchen, und was auf ihr liegt, liegt sichtbar
 * nebeneinander statt hintereinander.
 *
 * Ganz senkrecht wird er trotzdem nicht: Von genau oben verschwaende die
 * Tiefe, und der Tisch waere eine Landkarte.
 *
 * Naeher als frueher, und zwar entlang derselben Blickachse -- der Winkel
 * bleibt also, nur der Abstand schrumpft um ein Viertel. Grund ist die
 * Vorlage: Dort fuellt die Spielflaeche das ganze Bild, und die Mitspieler
 * sitzen am Bildrand. Bei einem Tisch, der nur zwei Drittel der Breite
 * einnimmt, laesst sich beides nicht zugleich haben -- entweder sitzen die
 * Blaetter am Bildrand oder auf dem Tisch.
 */
const EYE = new Vector3(0, 6.5, 5.23)
const LOOK = new Vector3(0, 0.1, -0.25)

/** Bildwinkel bei ausreichend breitem Fenster. */
const BASE_FOV = 43

/**
 * Ab diesem Seitenverhaeltnis bleibt der Bildwinkel stehen.
 *
 * Wird das Fenster schmaler, waechst stattdessen der senkrechte Bildwinkel,
 * sodass der waagerechte gleich bleibt. Ohne das schneidet ein schmales
 * Fenster die aeusseren Sitzplaetze ab -- die Kamera bliebe ja gleich weit
 * weg, sie saehe nur weniger nach links und rechts.
 */
const MIN_ASPECT = 1.55

export type Stage = {
  readonly renderer: WebGLRenderer
  readonly scene: Scene
  readonly camera: PerspectiveCamera
  readonly canvas: HTMLCanvasElement
  /** Ob der Rechner um zurueckhaltende Bewegung gebeten hat. */
  readonly reducedMotion: boolean
  /** Meldet eine Funktion fuer jedes Bild an; der Rueckgabewert meldet sie ab. */
  onFrame(update: (dt: number, elapsed: number) => void): () => void
  /** Weltpunkt zu Bildschirmpunkt, in CSS-Pixeln innerhalb der Zeichenflaeche. */
  toScreen(point: Vector3, out: Vector2): Vector2
  /** Ob ein Weltpunkt ueberhaupt vor der Kamera liegt. */
  isInFront(point: Vector3): boolean
  /** Der Strahl vom Zeiger in die Szene. */
  rayAt(clientX: number, clientY: number): Raycaster
  /** Wo dieser Strahl eine waagerechte Ebene trifft. */
  planePoint(clientX: number, clientY: number, level: number, out: Vector3): Vector3 | null
  /** Gemessene Bildrate, geglaettet. Fuer die Leistungsgrenze aus Stufe 7. */
  fps(): number
  dispose(): void
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    // Nur fuer Werkzeug-Screenshots im Dev-Betrieb; kostet etwas Leistung.
    preserveDrawingBuffer: import.meta.env.DEV,
  })
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.03

  const scene = new Scene()
  const camera = new PerspectiveCamera(BASE_FOV, 1, 0.1, 120)
  camera.position.copy(EYE)
  camera.lookAt(LOOK)

  /* --- Bildaufteilung --------------------------------------------- */

  /**
   * Die Aufloesung folgt dem Bildschirm, aber nur bis zum Doppelten.
   *
   * Darueber hinaus kostet jedes weitere Pixel Leistung, ohne dass man es
   * sieht. Wird es trotzdem zu langsam, senkt `watchSpeed` den Wert weiter.
   */
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2)

  let width = 1
  let height = 1

  function layout(): void {
    const rect = canvas.getBoundingClientRect()
    width = Math.max(1, Math.round(rect.width))
    height = Math.max(1, Math.round(rect.height))

    const aspect = width / height
    camera.aspect = aspect
    camera.fov =
      aspect >= MIN_ASPECT
        ? BASE_FOV
        : (2 * Math.atan((Math.tan((BASE_FOV / 2) * (Math.PI / 180)) * MIN_ASPECT) / aspect) * 180) /
          Math.PI
    camera.updateProjectionMatrix()

    renderer.setPixelRatio(pixelRatio)
    renderer.setSize(width, height, false)
  }

  const observer = new ResizeObserver(layout)
  observer.observe(canvas)
  layout()

  /* --- Bildschleife ------------------------------------------------ */

  const updates = new Set<(dt: number, elapsed: number) => void>()

  let handle = 0
  let last = performance.now()
  let elapsed = 0
  let smoothed = 60

  function frame(now: number): void {
    handle = requestAnimationFrame(frame)

    // Nach einem Tabwechsel liegt zwischen zwei Bildern gern eine Minute.
    // Ungebremst haette die Feder danach eine Katapultwirkung.
    const dt = Math.min(0.05, Math.max(0.0005, (now - last) / 1000))
    last = now
    elapsed += dt

    smoothed += (1 / dt - smoothed) * 0.05
    watchSpeed()

    for (const update of updates) update(dt, elapsed)
    renderer.render(scene, camera)
  }

  /**
   * Die Leistungsgrenze aus Stufe 7.
   *
   * Bleibt die Bildrate laenger unter der Schwelle, wird die Aufloesung
   * gesenkt -- lieber etwas weicher als ruckelig. Zurueck geht es nicht:
   * Ein Auf und Ab der Schaerfe faellt staerker auf als eine dauerhaft
   * etwas niedrigere Aufloesung.
   */
  let slowFrames = 0

  /**
   * Wie lange die Bremse nach dem Start stillhaelt.
   *
   * Die ersten Sekunden sind die langsamsten der ganzen Partie: Die
   * Kartentafel wird entschluesselt, die Texturen wandern zur Grafikkarte,
   * der Raum entsteht. Wer da misst, misst das Laden und nicht das Spiel --
   * und senkt die Aufloesung fuer den Rest des Abends, denn zurueck geht es
   * nicht. Die Bremse schaut deshalb erst hin, wenn der Raum steht.
   */
  const WARMUP = 5

  function watchSpeed(): void {
    if (elapsed < WARMUP || smoothed >= 45 || pixelRatio <= 1) {
      slowFrames = 0
      return
    }
    if (++slowFrames < 120) return

    slowFrames = 0
    pixelRatio = Math.max(1, pixelRatio - 0.25)
    layout()
    console.info(`Runecall: Aufloesung auf ${pixelRatio.toFixed(2)} gesenkt (${smoothed.toFixed(0)} B/s)`)
  }

  handle = requestAnimationFrame(frame)

  // Nur fuer Werkzeuge im Dev-Betrieb: treibt die Schleife von Hand an, wenn
  // der Tab unsichtbar ist und requestAnimationFrame stillsteht.
  if (import.meta.env.DEV) {
    Object.assign(window, {
      __tick(dt = 1 / 60): void {
        elapsed += dt
        for (const update of updates) update(dt, elapsed)
        renderer.render(scene, camera)
      },
    })
  }

  /* --- Umrechnungen ------------------------------------------------ */

  const scratch = new Vector3()
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  const ground = new Plane(new Vector3(0, 1, 0), 0)

  function rayAt(clientX: number, clientY: number): Raycaster {
    const rect = canvas.getBoundingClientRect()
    pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    )
    raycaster.setFromCamera(pointer, camera)
    return raycaster
  }

  return {
    renderer,
    scene,
    camera,
    canvas,
    reducedMotion,

    onFrame(update) {
      updates.add(update)
      return () => updates.delete(update)
    },

    toScreen(point, out) {
      scratch.copy(point).project(camera)
      out.set(((scratch.x + 1) / 2) * width, ((1 - scratch.y) / 2) * height)
      return out
    },

    isInFront(point) {
      scratch.copy(point).project(camera)
      return scratch.z < 1
    },

    rayAt,

    planePoint(clientX, clientY, level, out) {
      ground.constant = -level
      const hit = rayAt(clientX, clientY).ray.intersectPlane(ground, out)
      return hit === null ? null : out
    },

    fps: () => smoothed,

    dispose() {
      cancelAnimationFrame(handle)
      observer.disconnect()
      updates.clear()
      renderer.dispose()
    },
  }
}

/** Die Blickrichtung -- gebraucht, wo etwas der Kamera zugewandt liegen soll. */
export const CAMERA_EYE = EYE.clone()
