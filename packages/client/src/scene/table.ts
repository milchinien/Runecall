/**
 * Der Tisch in der Szene.
 *
 * Hier wird aus dem Spielstand ein Bild: wer wo sitzt, welche Karten vor wem
 * liegen, was in der Mitte gestapelt ist -- und was sich gerade bewegt.
 *
 * Karten sind Bilder, keine Koerper. Sie zeigen immer zur Kamera; ihre Lage
 * besteht aus einem Punkt im Raum, einer Drehung in der Bildebene und einer
 * Groesse. Der Raum ringsum bleibt raeumlich -- Tisch, Licht, Partikel --,
 * aber was auf ihm gespielt wird, liegt darueber wie in einem flachen
 * Kartenspiel. Warum das so ist, steht in `deck.ts`.
 *
 * Bewegt wird nach Zeit, nicht nach Kraft: Jede Bewegung hat eine feste Dauer
 * und eine feste Kurve (`motion.ts`). Ein Ziel, das sich nicht geaendert hat,
 * loest keine neue Bewegung aus -- das ist die Regel, an der frueher das
 * Zittern haengenblieb, wenn ein Neuzeichnen mitten in eine Bewegung fiel.
 *
 * Was vor was liegt, entscheidet die Reihenfolge, die dieser Teil vergibt,
 * nicht der Abstand zur Kamera. Die Baender stehen bei `ORDER`.
 *
 * Regeln stehen hier keine. Was gelegt werden darf, sagt die Engine; dieser
 * Teil zeigt es an und meldet zurueck, worauf jemand gezeigt hat.
 */

import { Group, Mesh, Plane, Quaternion, Vector2, Vector3 } from 'three'
import { sortForDisplay } from '@runecall/engine'
import type { Card, CardId, PlayerView } from '@runecall/engine'

import type { CardArt, CardAtlas } from './atlas.ts'
import {
  CARD_H,
  CARD_W,
  MIRROR_SQUASH,
  createCardBody,
  createCardMaterials,
  createPileMat,
} from './deck.ts'
import type { CardBody, CardMaterials } from './deck.ts'
import {
  arcHeight,
  clamp,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  jitterSigned,
  lerp,
} from './motion.ts'
import { PLATE_HEIGHT, PLATE_REACH, ellipse, seatRing } from './seats.ts'
import type { Seat } from './seats.ts'
import { emitSceneSound } from './sound.ts'
import type { Stage } from './stage.ts'

/* ------------------------------------------------------------------ *
 * Masse der Anordnung
 * ------------------------------------------------------------------ */

/**
 * Wo die eigene Hand haengt, gemessen von der Kamera aus.
 *
 * Nicht in Tischkoordinaten, sondern in Blickrichtung: so weit vor der Kamera,
 * so weit unter der Blickachse. Damit sitzt der Faecher immer an derselben
 * Stelle des Bildes, und seine Karten haben immer dieselbe Groesse -- egal wie
 * der Tisch darunter steht.
 */
const HAND_DISTANCE = 10.5
const HAND_DROP = 2.65

/**
 * Der eigene Faecher: Schrittweite, Gesamtbreite, Neigung, Durchhang.
 *
 * Die Masse folgen der Vorlage, gemessen als Anteil des Bildes: Dort ist eine
 * eigene Karte 19 Prozent der Bildhoehe hoch, der Faecher nimmt 41 Prozent der
 * Breite ein und seine Mitte liegt bei 83 Prozent der Hoehe. Vorher war die
 * eigene Hand mit 28 Prozent deutlich zu gross und deckte den Ablagestapel zur
 * Haelfte zu.
 */
const HAND_STEP_MAX = 0.93
const HAND_WIDTH = 8.1
const HAND_SPREAD = 0.34
const HAND_ARC = 0.45

/**
 * Die Blaetter der Mitspieler.
 *
 * Ein Blatt haelt man aufgefaechert: Die Karten drehen sich um einen Punkt
 * unter der Hand, ihre Unterkanten treffen sich fast, nach oben laufen sie
 * auseinander. Das ist die Form, die eine Hand einer Kartenreihe aufzwingt --
 * man haelt sie zwischen Daumen und Fingern, und der Daumen ist der
 * Drehpunkt.
 *
 * Vorher stand hier ein *Stapel*: alle Karten parallel, stark ueberlappend,
 * stark geneigt. Der war nach einer Vorlage ausgemessen und traf sie auch --
 * aber er sah aus wie ein Buendel Karten, das jemand auf den Tisch gelegt und
 * dabei verrutscht hat, nicht wie ein Blatt, das jemand haelt. Gemessen
 * richtig ist nicht dasselbe wie gesehen richtig.
 *
 * `SIZE` ist nicht in Weltmass angegeben, sondern je Einheit Entfernung: Ein
 * Blatt weiter hinten bekommt entsprechend groessere Karten und sieht dadurch
 * im Bild genauso gross aus wie eines weiter vorn. Ohne das haette der
 * naechste Mitspieler doppelt so grosse Karten wie der gegenueber -- richtig
 * gerechnet, aber unruhig anzusehen.
 */
const AWAY_REACH = 0.9
const AWAY_LIFT = 0.3
const AWAY_SIZE = 0.056

/**
 * Wie weit ein Blatt nach hinten gekippt ist: ein Stueck, nicht weit.
 *
 * Gehaltene Karten zeigen zum Halter, nicht zur Decke -- von uns aus also
 * leicht weg. Weiter gekippt (frueher stand hier 0,55) staucht die Karte im
 * Bild so stark, dass aus dem Hochformat fast ein Quadrat wird; genau das
 * liess die Blaetter unecht aussehen. Bei diesem Wert bleibt die Karte eine
 * Karte und sitzt trotzdem sichtbar im Raum.
 */
const AWAY_LAY = 0.26

/**
 * Der Faecher: Winkel je Karte, Gesamtwinkel, Drehpunkt.
 *
 * `STEP` ist der Winkel zwischen zwei benachbarten Karten. `TOTAL` deckelt
 * ihn bei vollem Blatt -- dreizehn Karten mal vollem Schritt waeren eine
 * Dreiviertelumdrehung, also ein Rad und kein Blatt; bei vielen Karten rueckt
 * der Faecher deshalb enger zusammen, statt breiter zu werden. Genau das tut
 * eine Hand auch.
 *
 * `PIVOT` ist der Drehpunkt, gemessen in Kartenhoehen unterhalb der
 * Kartenmitte. Knapp ueber der halben Kartenhoehe liegt er damit dicht an der
 * Unterkante: Die Karten treffen sich unten fast und laufen nach oben
 * auseinander. Weiter unten wuerde daraus ein Bogen, dessen Karten
 * nebeneinander stehen statt sich zu ueberlappen.
 */
const AWAY_FAN_STEP = 0.15
const AWAY_FAN_TOTAL = 1.05
const AWAY_PIVOT = 0.62

/**
 * Wie weit ein Blatt insgesamt zur Seite geneigt steht.
 *
 * Wer seitlich sitzt, haelt seine Karten schraeg zu uns -- er dreht sie zu
 * sich, und wir sehen diese Drehung. Die Richtung steht fest: Beide Seiten
 * neigen sich von der Tischmitte weg, nicht zu ihr hin. Wer genau gegenueber
 * sitzt, bekommt keine Neigung; sein Blatt liegt quer zum Blick, und alles
 * Schiefe daran saehe von hier aus nach einem Fehler aus.
 */
const AWAY_LEAN = 0.2


/**
 * Wie flach etwas liegt: 0 zeigt zur Kamera, 1 liegt auf der Tischplatte.
 *
 * Der eigene Faecher und die Faecher der Mitspieler zeigen zur Kamera -- sie
 * werden gehalten, nicht abgelegt. Was auf dem Tisch liegt, legt sich auch
 * hin. Ganz flach ist es trotzdem nicht: Bei voller Neigung sieht man eine
 * Karte unter dem Blickwinkel der Kamera nur noch gut halb so hoch, und genau
 * das liess die Motive vorher gestaucht aussehen. Bei diesem Wert bleiben rund
 * drei Viertel der Hoehe stehen -- die Karte liegt sichtbar, das Bild darauf
 * bleibt ein Bild.
 */
const PILE_LAY = 0.72
const TRUMP_LAY = 0.78

/**
 * Der Ablagestapel, auf der Tischmitte.
 *
 * `SCALE` haelt ihn auf dem Anteil, den die Vorlage zeigt: dort ist die
 * oberste Karte des Stapels 17 Prozent der Bildhoehe hoch, etwas kleiner als
 * eine eigene Handkarte und deutlich groesser als eine fremde.
 */
const PILE_AT = new Vector3(0, 0.05, 0.35)
const PILE_SCALE = 0.75
const PILE_SCATTER = 0.34
/** Wie weit eine gelegte Karte zu ihrem Spieler hin versetzt liegt. */
const PILE_BIAS = 0.34

/**
 * Die Trumpfkarte liegt neben dem Stapel, wie ein zweiter Haufen.
 *
 * Rechts, nicht links: Seit die Blaetter der Mitspieler auf der Tischplatte
 * stehen, ist der Tisch innen enger geworden. Links bleibt zwischen dem Blatt
 * des Nachbarn und dem Stapel keine Kartenbreite mehr, rechts schon.
 */
const TRUMP_AT = new Vector3(2.15, 0.05, -0.15)
const TRUMP_SCALE = 0.62

/** Wie weit eine Karte sich hebt, wenn Zeiger oder Tastatur auf ihr stehen. */
const LIFT_OUT = 0.3
const LIFT_SCALE = 1.07

/**
 * Ab hier gilt ein Zug als Legen.
 *
 * Gemessen wird, wie weit die Karte im Bild nach oben gewandert ist -- dorthin
 * liegt der Stapel. Wer nur ein Stueck wackelt, hat nicht gelegt, sondern
 * ueberlegt.
 */
const THROW_LIFT = 0.85

/** Dauer der Bewegungen in Sekunden. */
const DEAL = 0.32
const SORT = 0.22
const LIFT = 0.13
const PLAY = 0.34
const COLLECT = 0.36
const FLIP = 0.44

/**
 * Wer vor wem liegt.
 *
 * Feste Baender statt Abstand zur Kamera: Der eigene Faecher deckt den Stapel,
 * der Stapel die Faecher der Mitspieler, und was gerade in der Hand haengt,
 * liegt ueber allem. Innerhalb eines Bandes zaehlt die Reihenfolge im Faecher
 * beziehungsweise im Stich, in Zweierschritten -- der Schatten einer Karte
 * belegt den halben Schritt darunter.
 */
const ORDER = {
  away: 20,
  pile: 200,
  trump: 160,
  hand: 400,
  held: 900,
} as const

/* ------------------------------------------------------------------ *
 * Lage einer Karte
 * ------------------------------------------------------------------ */

type Pose = {
  x: number
  y: number
  z: number
  /** Drehung in der eigenen Ebene. */
  roll: number
  scale: number
  /** 0 zeigt zur Kamera, 1 liegt flach auf dem Tisch. */
  lay: number
  /**
   * Drehung um die senkrechte Achse des Raums.
   *
   * Das ist die einzige Drehung, die eine Karte perspektivisch verzieht: Die
   * eine Kante rueckt weg, die andere kommt naeher, aus dem Rechteck wird ein
   * Trapez. Alle anderen Drehungen sind in der Bildebene und aendern nur die
   * Lage, nicht die Form.
   */
  yaw: number
  /** 1 zeigt das Motiv, 0 die Rueckseite; dazwischen steht die Karte auf der Kante. */
  flip: number
}

type Move = {
  from: Pose
  to: Pose
  elapsed: number
  duration: number
  ease: (t: number) => number
  /** Hoehe des Bogens ueber der geraden Verbindung, im Bild nach oben. */
  arc: number
  /** Ob die Karte beim Ankommen kurz ueber ihr Mass hinausgeht. */
  pop: boolean
  onLand: (() => void) | null
}

type Piece = {
  readonly body: CardBody
  readonly pose: Pose
  /** Die zuletzt befohlene Ruhelage. Gleiches Ziel heisst: nichts tun. */
  goal: Pose | null
  move: Move | null
  /** Ob die Karte schon einmal an einem Platz stand. */
  placed: boolean
  front: CardArt
  back: CardArt
  showsFront: boolean
  tint: number
  tintTarget: number
  /** Faellt von 1 auf 0, wenn die Karte den Tisch verlaesst. */
  fade: number
  fadeTarget: number
  retiring: boolean
}

const pose = (
  at: Vector3,
  roll: number,
  scale = 1,
  lay = 0,
  yaw = 0,
  flip = 1,
): Pose => ({ x: at.x, y: at.y, z: at.z, roll, scale, lay, yaw, flip })

const copyPose = (from: Pose): Pose => ({ ...from })

/** Ob zwei Lagen so nah beieinander liegen, dass eine Bewegung nichts brächte. */
function samePose(a: Pose | null, b: Pose): boolean {
  if (a === null) return false
  return (
    Math.abs(a.x - b.x) < 0.002 &&
    Math.abs(a.y - b.y) < 0.002 &&
    Math.abs(a.z - b.z) < 0.002 &&
    Math.abs(a.roll - b.roll) < 0.002 &&
    Math.abs(a.scale - b.scale) < 0.002 &&
    Math.abs(a.lay - b.lay) < 0.002 &&
    Math.abs(a.yaw - b.yaw) < 0.002 &&
    Math.abs(a.flip - b.flip) < 0.002
  )
}

/* ------------------------------------------------------------------ *
 * Aussenansicht
 * ------------------------------------------------------------------ */

export type TableHandlers = {
  /** Jemand hat eine eigene Handkarte angeklickt oder in die Mitte gezogen. */
  readonly onPick: (cardId: CardId) => void
  /** Der Zeiger steht ueber einer Karte -- oder ueber keiner mehr. */
  readonly onHover: (cardId: CardId | null) => void
  /** Ein Klick ins Leere. Kuerzt die laufende Wartezeit ab (Frage 16). */
  readonly onEmptyClick: () => void
}

export type TableScene = {
  /** Uebernimmt einen Spielstand. Darf so oft aufgerufen werden wie noetig. */
  show(view: PlayerView, frozen: boolean): void
  /** Hebt eine Karte an, weil Zeiger oder Tastatur auf ihr stehen. */
  focus(cardId: CardId | null): void
  /** Hebt eine Karte deutlicher an -- der erste Tipp am Telefon (Frage 2.10). */
  select(cardId: CardId | null): void
  /** Bildschirmpunkt eines Sitzes, fuer sein Namensschild. */
  seatAt(seat: number, out: Vector2): Vector2 | null
  /** Bildschirmpunkt einer eigenen Handkarte, fuer die Tastaturhand. */
  cardAt(cardId: CardId, out: Vector2): Vector2 | null
  /** Groesse einer Handkarte auf dem Bildschirm, in CSS-Pixeln. */
  cardSize(): { readonly width: number; readonly height: number }
  /** Raeumt den Tisch -- neue Partie. */
  reset(): void
  dispose(): void
}

export function createTableScene(
  stage: Stage,
  atlas: CardAtlas,
  handlers: TableHandlers,
): TableScene {
  const root = new Group()
  stage.scene.add(root)

  const materials: CardMaterials = createCardMaterials(atlas.texture)
  const pileMat = createPileMat()
  root.add(pileMat)

  const pieces = new Map<string, Piece>()
  const spare: CardBody[] = []

  /**
   * Bei zurueckhaltender Bewegung wird nicht bewegt, sondern gesetzt.
   * Die Wege bleiben, sie dauern nur fast nichts und haben keinen Bogen.
   */
  const calm = stage.reducedMotion
  const timeScale = calm ? 0.12 : 1
  const arcScale = calm ? 0 : 1

  /* --- Die Bildebene ------------------------------------------------ */

  /**
   * Die drei Richtungen, in denen hier gerechnet wird.
   *
   * Sie kommen aus der Kamera und stehen fest, weil die Kamera feststeht:
   * `right` und `up` spannen die Bildebene auf, `toward` zeigt zum Betrachter.
   * Eine Karte um `up` zu verschieben heisst deshalb "im Bild nach oben" --
   * unabhaengig davon, wo auf dem Tisch sie liegt.
   */
  const FACE = stage.camera.quaternion.clone()
  const RIGHT = new Vector3(1, 0, 0).applyQuaternion(FACE)
  const UP = new Vector3(0, 1, 0).applyQuaternion(FACE)
  const TOWARD = new Vector3(0, 0, 1).applyQuaternion(FACE)

  /**
   * Die zweite Ausrichtung: flach auf der Tischplatte, Oberkante nach hinten.
   *
   * Zwischen ihr und `FACE` wird gedreht, je nachdem wie flach etwas liegen
   * soll. Eine Karte auf dem Weg in die Mitte legt sich damit unterwegs hin,
   * statt an ihrem Ziel umzuklappen.
   */
  const LAID = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2)
  const facing = new Quaternion()


  /** Der Anker des eigenen Faechers, aus Kameraabstand und Bildlage. */
  const HAND_AT = new Vector3()
    .copy(stage.camera.position)
    .addScaledVector(TOWARD, -HAND_DISTANCE)
    .addScaledVector(UP, -HAND_DROP)

  const spin = new Quaternion()
  const turn = new Quaternion()
  const forward = new Vector3(0, 0, 1)
  const scratch = new Vector3()
  const worldPoint = new Vector3()
  const measure = new Vector3()
  const screenA = new Vector2()
  const screenB = new Vector2()

  /** Ein Punkt neben einem Anker, gemessen in der Bildebene. */
  function pointAt(anchor: Vector3, right: number, up: number, toward: number): Vector3 {
    return scratch
      .copy(anchor)
      .addScaledVector(RIGHT, right)
      .addScaledVector(UP, up)
      .addScaledVector(TOWARD, toward)
  }

  const FALLBACK_SEAT: Seat = { index: 0, angle: 0, facing: 0, at: new Vector3() }
  const seatOf = (index: number): Seat => seats[index] ?? FALLBACK_SEAT

  let seats: Seat[] = seatRing(3)
  let handOrder: Card[] = []
  let focused: CardId | null = null
  let selected: CardId | null = null
  let playable = new Set<CardId>()
  let lastWinner = 0
  let seenPlays = new Set<CardId>()
  let seenTrump: CardId | null = null
  let dealtRound = ''

  /* --- Karten kommen und gehen ------------------------------------- */

  function obtain(key: string, artId: string): Piece {
    const existing = pieces.get(key)
    if (existing !== undefined) {
      existing.retiring = false
      existing.fadeTarget = 1
      return existing
    }

    const body = spare.pop() ?? createCardBody(materials)
    const front = atlas.art(artId)
    body.setArt(front)

    // Ein Koerper aus dem Vorrat bringt mit, was der Vorbesitzer eingestellt
    // hat. Schatten und Spiegelung gehoeren deshalb hier zurueckgesetzt --
    // sonst spiegelt sich ploetzlich die eigene Hand, weil ihr Koerper vorher
    // bei einem Mitspieler lag.
    body.shade.visible = true
    body.mirror.visible = false
    root.add(body.mesh, body.shade, body.mirror)

    const piece: Piece = {
      body,
      pose: { x: 0, y: 0, z: 0, roll: 0, scale: 1, lay: 0, yaw: 0, flip: 1 },
      goal: null,
      move: null,
      placed: false,
      front,
      back: atlas.back,
      showsFront: true,
      tint: 1,
      tintTarget: 1,
      fade: 1,
      fadeTarget: 1,
      retiring: false,
    }

    pieces.set(key, piece)
    return piece
  }

  function retire(key: string, piece: Piece): void {
    pieces.delete(key)
    root.remove(piece.body.mesh, piece.body.shade, piece.body.mirror)
    spare.push(piece.body)
  }

  /* --- Bewegen ------------------------------------------------------ */

  /** Setzt eine Karte ohne Bewegung an ihren Platz. */
  function put(piece: Piece, to: Pose): void {
    Object.assign(piece.pose, to)
    piece.goal = copyPose(to)
    piece.move = null
    piece.placed = true
  }

  /**
   * Bringt eine Karte an eine neue Ruhelage.
   *
   * Steht sie schon dorthin unterwegs, geschieht nichts -- sonst finge jedes
   * Neuzeichnen die Bewegung von vorn an, und die Karte kaeme nie an.
   */
  function moveTo(
    piece: Piece,
    to: Pose,
    duration: number,
    options: { ease?: (t: number) => number; arc?: number; pop?: boolean; onLand?: () => void } = {},
  ): void {
    if (samePose(piece.goal, to)) return

    piece.goal = copyPose(to)
    piece.move = {
      from: copyPose(piece.pose),
      to: copyPose(to),
      elapsed: 0,
      duration: Math.max(0.04, duration * timeScale),
      ease: options.ease ?? easeInOutCubic,
      arc: (options.arc ?? 0) * arcScale,
      pop: options.pop ?? false,
      onLand: options.onLand ?? null,
    }
    piece.placed = true
  }

  /* --- Anordnungen -------------------------------------------------- */

  /** Der Faecher der eigenen Hand. */
  function handPose(index: number, count: number): Pose {
    const centred = count > 1 ? index / (count - 1) - 0.5 : 0
    const step = count > 1 ? Math.min(HAND_STEP_MAX, HAND_WIDTH / (count - 1)) : 0
    const spread = Math.min(HAND_SPREAD, 0.075 * count)

    const at = pointAt(
      HAND_AT,
      centred * step * (count - 1),
      -centred * centred * HAND_ARC,
      index * 0.012,
    )
    return pose(at, -centred * spread * 2)
  }

  /**
   * Der Faecher eines Mitspielers: Rueckseiten, an seinem Platz.
   *
   * Gerechnet wird wie bei einer Hand, die ein Blatt haelt: Alle Karten
   * haengen an *einem* Drehpunkt unter der Hand und stehen jede ein Stueck
   * weiter gedreht. Ihre Mittelpunkte liegen damit von selbst auf einem
   * Kreisbogen -- der Bogen ist kein eigener Wert, den man einstellt, sondern
   * faellt aus dem Drehpunkt heraus.
   *
   * Gemessen wird gegen die *mittlere* Karte, nicht gegen die erste: So sitzt
   * das Blatt auf seinem Platz, egal wie weit es aufgezogen ist. Rechnete man
   * von der ersten Karte aus, wanderte der ganze Faecher zur Seite, sobald
   * eine Karte gelegt wird.
   */
  function awayPose(seat: Seat, index: number, count: number): Pose {
    // Wie weit der Platz zur Seite sitzt: 1 ganz rechts, -1 ganz links, 0
    // genau gegenueber. Die Neigung des Blattes haengt daran.
    const sideways = Math.sin(seat.angle)

    // Die Drehung um die Blickachse zaehlt gegen den Uhrzeigersinn, daher das
    // Minus: rechts im Uhrzeigersinn, links dagegen -- beide von der
    // Tischmitte weg.
    const lean = -sideways * AWAY_LEAN
    const anchor = ellipse(seat.angle, AWAY_REACH, AWAY_LIFT)
    const far = stage.camera.position.distanceTo(anchor)
    const size = AWAY_SIZE * far

    const spread = count > 1 ? Math.min(AWAY_FAN_STEP, AWAY_FAN_TOTAL / (count - 1)) : 0
    const middle = (count - 1) / 2
    const roll = lean + (index - middle) * spread

    // Die Karte sitzt auf dem Kreis um den Drehpunkt. Ihre Mitte liegt eine
    // Pivotlaenge ueber ihm, in *ihrer eigenen*, schon gedrehten Hochachse --
    // deshalb sin und cos des ganzen Winkels und nicht nur des Faecheranteils.
    const pivot = AWAY_PIVOT * CARD_H * size
    const swingX = pivot * (Math.sin(lean) - Math.sin(roll))
    const swingY = pivot * (Math.cos(roll) - Math.cos(lean))

    const at = scratch
      .copy(anchor)
      .addScaledVector(RIGHT, swingX)
      .addScaledVector(UP, swingY)
      .addScaledVector(TOWARD, index * 0.01)

    return pose(at, roll, size, AWAY_LAY)
  }

  /**
   * Die Lage auf dem Ablagestapel.
   *
   * Versetzt und verdreht, aber nicht zufaellig: Die Streuung kommt aus der
   * Kartenkennung, damit ein erneutes Zeichnen desselben Standes den Stapel
   * nicht durchruettelt. Dazu ein Versatz in Richtung des Spielers -- so
   * bleibt auch nach der Landung sichtbar, von wo die Karte kam.
   */
  function pilePose(card: CardId, order: number, player: number): Pose {
    const bias = ellipse(seatOf(player).angle, 1, 0).normalize().multiplyScalar(PILE_BIAS)

    // Gestreut wird auf der Tischplatte, nicht in der Bildebene: Eine liegende
    // Karte, die man nach oben schoebe, hoebe vom Tisch ab. Die Hoehe traegt
    // nur den Stapel -- jede Karte liegt einen Hauch ueber der darunter.
    const at = scratch.set(
      PILE_AT.x + bias.x + jitterSigned(card, 11) * PILE_SCATTER,
      PILE_AT.y + order * 0.004,
      PILE_AT.z + bias.z + jitterSigned(card, 23) * PILE_SCATTER * 0.8,
    )
    return pose(at, jitterSigned(card, 37) * 0.34, PILE_SCALE, PILE_LAY)
  }

  const trumpPose = (faceUp: boolean): Pose =>
    pose(TRUMP_AT, 0.14, TRUMP_SCALE, TRUMP_LAY, 0, faceUp ? 1 : 0)

  /* --- Spielstand uebernehmen --------------------------------------- */

  function show(view: PlayerView, frozen: boolean): void {
    if (view.handSizes.length !== seats.length) seats = seatRing(view.handSizes.length)

    handOrder = sortForDisplay(view.hand, view.trumpSuit)
    playable = new Set(view.playable)
    if (view.lastTrick !== null) lastWinner = view.lastTrick.winner

    // Beim Rundenwechsel wird neu ausgeteilt -- alles Bisherige ist Geschichte.
    const round = `${view.roundNumber}`
    if (round !== dealtRound) {
      dealtRound = round
      seenPlays = new Set()
      seenTrump = null
    }

    const keep = new Set<string>()

    layoutHand(keep)
    layoutAway(view, keep)
    layoutPile(view, frozen, keep)
    layoutTrump(view, keep)

    // Was nicht mehr gebraucht wird, zieht zum Gewinner des letzten Stichs.
    for (const [key, piece] of pieces) {
      if (keep.has(key) || piece.retiring) continue
      collect(key, piece)
    }
  }

  function layoutHand(keep: Set<string>): void {
    const count = handOrder.length

    handOrder.forEach((card, index) => {
      const key = `hand:${card.id}`
      keep.add(key)

      const piece = obtain(key, card.id)
      const target = handPose(index, count)

      piece.body.mesh.userData['cardId'] = card.id
      piece.tintTarget = playable.size > 0 && !playable.has(card.id) ? 0.62 : 1

      if (!piece.placed) {
        // Frisch ausgeteilt: die Karte kommt klein aus der Tischmitte.
        put(piece, pose(worldPoint.copy(PILE_AT), 0, 0.45, PILE_LAY))
        moveTo(piece, target, DEAL + index * 0.04, { ease: easeOutCubic, arc: 0.25, pop: true })
        if (index === 0) emitSceneSound('deal', 0.4)
      }

      const held = dragging?.cardId === card.id
      const strong = selected === card.id
      const lifted = strong || focused === card.id

      piece.body.setOrder(held || lifted ? ORDER.held : ORDER.hand + index * 2)
      if (held) return

      if (!lifted) {
        moveTo(piece, target, SORT)
        return
      }

      const reach = LIFT_OUT * (strong ? 1.5 : 1)
      moveTo(
        piece,
        {
          ...target,
          x: target.x + UP.x * reach,
          y: target.y + UP.y * reach,
          z: target.z + UP.z * reach,
          roll: target.roll * 0.4,
          scale: LIFT_SCALE,
        },
        LIFT,
        { ease: easeOutCubic },
      )
    })
  }

  function layoutAway(view: PlayerView, keep: Set<string>): void {
    for (let seat = 1; seat < view.handSizes.length; seat++) {
      const count = view.handSizes[seat] ?? 0

      for (let index = 0; index < count; index++) {
        const key = `away:${seat}:${index}`
        keep.add(key)

        const piece = obtain(key, 'back')
        const target = awayPose(seatOf(seat), index, count)
        piece.body.setOrder(ORDER.away + seat * 40 + index * 2)

        // Keine Spiegelung mehr. Sie stammt aus der Zeit, als die Blaetter als
        // Stapel schraeg auf der Platte standen -- da erdete sie das Blatt.
        // Ein gehaltener Faecher steht nicht auf dem Tisch, er wird darueber
        // gehalten, und eine Spiegelung darunter macht aus dem Filz eine
        // Pfuetze. Der weiche Schatten hinter der Karte reicht.
        piece.body.mirror.visible = false
        piece.body.shade.visible = true

        if (!piece.placed) {
          put(piece, pose(worldPoint.copy(PILE_AT), 0, 0.4, PILE_LAY))
          moveTo(piece, target, DEAL + index * 0.03, { ease: easeOutCubic, arc: 0.2 })
        } else {
          moveTo(piece, target, SORT)
        }
      }
    }
  }

  /**
   * Der Ablagestapel.
   *
   * Waehrend der Stichpause bleibt der gewonnene Stich liegen (Frage 19) --
   * dann zeigt `lastTrick`, was zu sehen ist, sonst der laufende Stich.
   */
  function layoutPile(view: PlayerView, frozen: boolean, keep: Set<string>): void {
    const plays = frozen && view.lastTrick !== null ? view.lastTrick.plays : view.currentTrick
    const winner = frozen ? (view.lastTrick?.winner ?? null) : null

    plays.forEach((play, order) => {
      const key = `pile:${play.card.id}`
      keep.add(key)

      const piece = obtain(key, play.card.id)
      const target = pilePose(play.card.id, order, play.player)
      piece.body.setOrder(ORDER.pile + order * 2)

      if (!seenPlays.has(play.card.id)) {
        seenPlays.add(play.card.id)
        launch(piece, play.player, play.card.id, view, target)
      } else {
        // Die Gewinnkarte des Stichs hebt sich heraus, statt nur heller zu sein.
        const won = play.player === winner
        moveTo(piece, won ? { ...target, scale: 1.12 } : target, SORT)
      }

      piece.tintTarget = winner === null || play.player === winner ? 1 : 0.6
    })
  }

  /**
   * Eine Karte wandert vom Platz ihres Spielers auf den Stapel.
   *
   * Der Startpunkt ist nicht "irgendwo beim Spieler", sondern die Karte, die
   * er eben noch in der Hand hatte: bei dir die angeklickte, bei den anderen
   * die letzte ihres Faechers. Genau diese Karte verschwindet dort im selben
   * Augenblick -- sonst laege sie doppelt auf dem Tisch.
   */
  function launch(
    piece: Piece,
    player: number,
    cardId: CardId,
    view: PlayerView,
    target: Pose,
  ): void {
    const sourceKey =
      player === view.you ? `hand:${cardId}` : `away:${player}:${view.handSizes[player] ?? 0}`
    const source = pieces.get(sourceKey)

    if (source !== undefined) {
      put(piece, copyPose(source.pose))
      retire(sourceKey, source)
    } else {
      put(piece, awayPose(seatOf(player), 0, 1))
    }

    const own = player === view.you
    emitSceneSound('throw', own ? 0.8 : 0.55)
    moveTo(piece, target, PLAY, {
      ease: easeOutCubic,
      arc: 0.3,
      pop: true,
      onLand: () => emitSceneSound('land', 0.6),
    })
  }

  function layoutTrump(view: PlayerView, keep: Set<string>): void {
    if (view.trumpCard === null) return

    const key = 'trump'
    keep.add(key)

    const piece = obtain(key, view.trumpCard.id)
    piece.body.setOrder(ORDER.trump)

    if (seenTrump !== view.trumpCard.id) {
      seenTrump = view.trumpCard.id
      piece.front = atlas.art(view.trumpCard.id)

      // Die Trumpfkarte dreht sich beim Aufdecken um: erst die Rueckseite,
      // dann durch die Kante hindurch das Motiv.
      piece.showsFront = false
      piece.body.setArt(piece.back)
      put(piece, trumpPose(false))
      emitSceneSound('flip', 0.45)
      moveTo(piece, trumpPose(true), FLIP, { ease: easeInOutCubic })
    } else {
      moveTo(piece, trumpPose(true), SORT)
    }
  }

  /**
   * Der gewonnene Stich zieht zum Gewinner, statt zu verschwinden.
   *
   * Auch alles andere, was den Tisch verlaesst, nimmt diesen Weg -- eine
   * Karte, die einfach ausgeht, sieht nach einem Fehler aus.
   */
  function collect(key: string, piece: Piece): void {
    const seat = seatOf(lastWinner)
    const to = ellipse(seat.angle, 1.02, 0.5)

    piece.retiring = true
    piece.fadeTarget = 0
    if (key.startsWith('pile:')) emitSceneSound('collect', 0.45)

    moveTo(piece, pose(to, piece.pose.roll * 0.5, 0.4, piece.pose.lay), COLLECT, {
      ease: easeInOutCubic,
      onLand: () => retire(key, piece),
    })
  }

  /* --- Bild fuer Bild ------------------------------------------------ */

  const stopFrames = stage.onFrame((dt) => {
    for (const piece of pieces.values()) advance(piece, dt)
  })

  function advance(piece: Piece, dt: number): void {
    const move = piece.move

    if (move !== null) {
      move.elapsed += dt
      const t = clamp(move.elapsed / move.duration, 0, 1)
      const path = move.ease(t)
      const rise = move.arc * arcHeight(t)

      piece.pose.x = lerp(move.from.x, move.to.x, path) + UP.x * rise
      piece.pose.y = lerp(move.from.y, move.to.y, path) + UP.y * rise
      piece.pose.z = lerp(move.from.z, move.to.z, path) + UP.z * rise
      piece.pose.roll = lerp(move.from.roll, move.to.roll, easeOutCubic(t))
      piece.pose.scale = lerp(move.from.scale, move.to.scale, move.pop ? easeOutBack(t) : path)
      piece.pose.lay = lerp(move.from.lay, move.to.lay, path)
      piece.pose.yaw = lerp(move.from.yaw, move.to.yaw, path)
      piece.pose.flip = lerp(move.from.flip, move.to.flip, path)

      if (t >= 1) {
        Object.assign(piece.pose, move.to)
        piece.move = null
        move.onLand?.()
      }
    }

    const ease = Math.min(1, dt * 11)
    piece.tint += (piece.tintTarget - piece.tint) * ease
    piece.fade += (piece.fadeTarget - piece.fade) * ease

    // Auf halbem Weg durch die Kante wechselt die Karte ihr Gesicht.
    const showsFront = piece.pose.flip > 0.5
    if (showsFront !== piece.showsFront) {
      piece.showsFront = showsFront
      piece.body.setArt(showsFront ? piece.front : piece.back)
    }

    const mesh = piece.body.mesh
    const size = piece.pose.scale * Math.max(0.001, piece.fade)
    const edge = Math.abs(Math.cos(Math.PI * piece.pose.flip))

    // Drei Drehungen, und zweierlei daran ist der Punkt.
    //
    // Die Reihenfolge: erst in der eigenen Ebene rollen, dann zwischen Blick
    // und Tischplatte kippen, dann wegschwenken. Andersherum schwenkte die
    // Karte um eine schon gekippte Achse und truedelte, statt sich wegzudrehen.
    //
    // Und die Achse des Schwenks ist die Hochachse des *Bildes*, nicht die des
    // Raums. Bei einem steilen Blick stehen die beiden schraeg zueinander: Um
    // die Raumachse gedreht legt sich die Karte im Bild schief, statt sich nur
    // wegzudrehen. Um die Bildachse bleibt sie aufrecht und wird zum Trapez --
    // genau das, was die Vorlage zeigt.
    facing.copy(FACE).slerp(LAID, piece.pose.lay)
    spin.setFromAxisAngle(forward, piece.pose.roll)
    turn.setFromAxisAngle(UP, piece.pose.yaw)
    mesh.position.set(piece.pose.x, piece.pose.y, piece.pose.z)
    mesh.quaternion.copy(turn).multiply(facing).multiply(spin)
    mesh.scale.set(Math.max(0.001, size * edge), size, 1)

    piece.body.setTint(piece.tint)
    updateShade(piece, size, edge)
    if (piece.body.mirror.visible) updateMirror(piece, size, edge)
  }

  /**
   * Die Spiegelung: dieselbe Karte, kopfueber, direkt unter ihrer Unterkante.
   *
   * Gespiegelt wird ueber eine negative Hoehe im Massstab -- damit steht das
   * Motiv auf dem Kopf, ohne dass eine zweite Textur noetig waere. Gestaucht
   * ist sie, weil eine Spiegelung zum Betrachter hin flacher wird, und ihr
   * Verlauf von hell nach dunkel steckt in den Eckpunkten (`deck.ts`).
   */
  function updateMirror(piece: Piece, size: number, edge: number): void {
    const mirror = piece.body.mirror
    const height = CARD_H * size

    mirror.quaternion.copy(piece.body.mesh.quaternion)
    mirror.position
      .set(0, -(height / 2) - (height * MIRROR_SQUASH) / 2, 0)
      .applyQuaternion(mirror.quaternion)
      .add(piece.body.mesh.position)
    mirror.scale.set(Math.max(0.001, size * edge), -size * MIRROR_SQUASH, 1)
  }

  /**
   * Der Schatten liegt hinter der Karte, ein Stueck nach unten versetzt.
   *
   * Er ist kein Schattenwurf, sondern das, was eine gezeichnete Karte vom
   * Untergrund abhebt: ein weicher dunkler Fleck, etwas groesser als sie
   * selbst. Beim Umdrehen schrumpft er mit -- eine Karte auf der Kante wirft
   * keinen breiten Schatten.
   */
  function updateShade(piece: Piece, size: number, edge: number): void {
    const shade = piece.body.shade
    const mesh = piece.body.mesh

    // Der Versatz wird in der Ebene der Karte gerechnet und mitgedreht: Bei
    // einer gehaltenen Karte faellt der Fleck im Bild nach unten, bei einer
    // liegenden auf dem Tisch nach vorn. Ein fester Versatz im Bild wuerde bei
    // liegenden Karten oberhalb landen -- ein Schatten ueber der Karte.
    const at = worldPoint
      .set(0.04 * size, -0.07 * size, -0.004)
      .applyQuaternion(mesh.quaternion)
      .add(mesh.position)

    shade.position.copy(at)
    shade.quaternion.copy(piece.body.mesh.quaternion)
    shade.scale.set(Math.max(0.001, size * edge * 1.3), size * 1.22, 1)
    shade.visible = piece.fade > 0.05

    const material = shade.material
    if (!Array.isArray(material)) material.opacity = 0.42 * piece.fade
  }

  /* --- Zeigen und Treffen -------------------------------------------- */

  /**
   * Welche Handkarte unter dem Zeiger liegt.
   *
   * In der Szene gibt es keine Elemente, die von selbst auf Klicks reagieren.
   * Also geht ein Strahl vom Zeiger in die Szene, und der naechstgelegene
   * Treffer gewinnt. Im Faecher liegt jede Karte eine Spur naeher an der
   * Kamera als ihre linke Nachbarin -- damit trifft der Strahl dieselbe, die
   * auch obenauf gezeichnet wird.
   */
  function pickAt(clientX: number, clientY: number): CardId | null {
    const meshes: Mesh[] = []
    for (const [key, piece] of pieces) {
      if (!key.startsWith('hand:') || piece.retiring) continue
      meshes.push(piece.body.mesh)
    }
    if (meshes.length === 0) return null

    const found = stage.rayAt(clientX, clientY).intersectObjects(meshes, false)
    const id = found[0]?.object.userData['cardId']
    return typeof id === 'string' ? id : null
  }

  /* --- Greifen und Ziehen -------------------------------------------- */

  /**
   * Karte greifen und nach oben ziehen.
   *
   * Der Klick bleibt daneben bestehen: Wer die Karte nur antippt und wieder
   * loslaesst, hat sie angeklickt. Erst ein deutliches Stueck nach oben, zum
   * Stapel hin, gilt als Legen.
   */
  type Drag = {
    readonly cardId: CardId
    readonly pointerId: number
    readonly start: Vector3
    readonly origin: Pose
    moved: boolean
  }

  let dragging: Drag | null = null
  const dragPlane = new Plane()
  const dragPoint = new Vector3()

  /** Wo der Zeiger die Ebene trifft, in der die eigenen Karten haengen. */
  function handPoint(clientX: number, clientY: number): Vector3 | null {
    dragPlane.setFromNormalAndCoplanarPoint(TOWARD, HAND_AT)
    return stage.rayAt(clientX, clientY).ray.intersectPlane(dragPlane, dragPoint)
  }

  function onPointerDown(event: PointerEvent): void {
    const id = pickAt(event.clientX, event.clientY)
    if (id === null) return

    const piece = pieces.get(`hand:${id}`)
    const at = handPoint(event.clientX, event.clientY)
    if (piece === undefined || at === null) return

    dragging = {
      cardId: id,
      pointerId: event.pointerId,
      start: at.clone(),
      origin: copyPose(piece.pose),
      moved: false,
    }
    piece.body.setOrder(ORDER.held)
    stage.canvas.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent): void {
    if (dragging === null) {
      if (event.pointerType === 'touch') return
      handlers.onHover(pickAt(event.clientX, event.clientY))
      return
    }

    const piece = pieces.get(`hand:${dragging.cardId}`)
    const at = handPoint(event.clientX, event.clientY)
    if (piece === undefined || at === null) return

    scratch.copy(at).sub(dragging.start)
    if (scratch.length() > 0.1) dragging.moved = true
    if (!dragging.moved) return

    // Die Karte haengt am Zeiger, ohne Nachlauf: gezogen wird gesetzt, nicht
    // bewegt. Alles andere fuehlt sich an, als klebte sie am Tisch.
    piece.move = null
    piece.goal = null
    piece.pose.x = dragging.origin.x + scratch.x
    piece.pose.y = dragging.origin.y + scratch.y
    piece.pose.z = dragging.origin.z + scratch.z
    piece.pose.roll = dragging.origin.roll * 0.3
    piece.pose.scale = LIFT_SCALE
  }

  function onPointerUp(event: PointerEvent): void {
    const drag = dragging
    dragging = null
    if (drag === null) return
    if (stage.canvas.hasPointerCapture(drag.pointerId)) {
      stage.canvas.releasePointerCapture(drag.pointerId)
    }

    const at = handPoint(event.clientX, event.clientY)
    const lift = at === null ? 0 : scratch.copy(at).sub(drag.start).dot(UP)

    if (!drag.moved || lift > THROW_LIFT) {
      handlers.onPick(drag.cardId)
      return
    }

    // Zu kurz gezogen: die Karte faellt in den Faecher zurueck.
    const piece = pieces.get(`hand:${drag.cardId}`)
    const index = handOrder.findIndex((card) => card.id === drag.cardId)
    if (piece !== undefined && index >= 0) {
      moveTo(piece, handPose(index, handOrder.length), SORT, { ease: easeOutCubic })
    }
  }

  function onPointerCancel(): void {
    dragging = null
    handlers.onHover(null)
  }

  function onClick(event: MouseEvent): void {
    if (pickAt(event.clientX, event.clientY) === null) handlers.onEmptyClick()
  }

  stage.canvas.addEventListener('pointerdown', onPointerDown)
  stage.canvas.addEventListener('pointermove', onPointerMove)
  stage.canvas.addEventListener('pointerup', onPointerUp)
  stage.canvas.addEventListener('pointercancel', onPointerCancel)
  stage.canvas.addEventListener('pointerleave', onPointerCancel)
  stage.canvas.addEventListener('click', onClick)

  /* --- Aussenansicht -------------------------------------------------- */

  return {
    show,

    focus(cardId) {
      if (focused === cardId) return
      if (cardId !== null) emitSceneSound('lift', 0.25)
      focused = cardId
      refreshHand()
    },

    select(cardId) {
      if (selected === cardId) return
      selected = cardId
      refreshHand()
    },

    seatAt(seat, out) {
      const at =
        seat === 0
          ? worldPoint.copy(HAND_AT).addScaledVector(RIGHT, -5).addScaledVector(UP, 0.5)
          : worldPoint.copy(ellipse(seatOf(seat).angle, PLATE_REACH, PLATE_HEIGHT))
      return stage.isInFront(at) ? stage.toScreen(at, out) : null
    },

    cardAt(cardId, out) {
      const piece = pieces.get(`hand:${cardId}`)
      if (piece === undefined) return null
      worldPoint.copy(piece.body.mesh.position)
      return stage.isInFront(worldPoint) ? stage.toScreen(worldPoint, out) : null
    },

    cardSize() {
      // Die Karte zeigt zur Kamera, ihre Hoehe im Bild folgt also allein aus
      // der Entfernung. Gemessen wird vom Mittelpunkt des Faechers zu seiner
      // Oberkante -- doppelt genommen ist das die ganze Karte.
      stage.toScreen(measure.copy(HAND_AT), screenA)
      stage.toScreen(measure.copy(HAND_AT).addScaledVector(UP, CARD_H / 2), screenB)

      const height = Math.max(24, screenA.distanceTo(screenB) * 2)
      return { width: height * (CARD_W / CARD_H), height }
    },

    reset() {
      for (const [key, piece] of pieces) retire(key, piece)
      pieces.clear()
      seenPlays = new Set()
      seenTrump = null
      dealtRound = ''
      focused = null
      selected = null
      dragging = null
      handOrder = []
    },

    dispose() {
      stopFrames()
      stage.canvas.removeEventListener('pointerdown', onPointerDown)
      stage.canvas.removeEventListener('pointermove', onPointerMove)
      stage.canvas.removeEventListener('pointerup', onPointerUp)
      stage.canvas.removeEventListener('pointercancel', onPointerCancel)
      stage.canvas.removeEventListener('pointerleave', onPointerCancel)
      stage.canvas.removeEventListener('click', onClick)

      for (const [key, piece] of pieces) retire(key, piece)
      for (const body of spare) body.dispose()
      spare.length = 0

      pileMat.geometry.dispose()
      if (!Array.isArray(pileMat.material)) pileMat.material.dispose()
      materials.dispose()
      stage.scene.remove(root)
    },
  }

  /** Rechnet nur den Faecher neu -- fuer Anheben und Auswaehlen. */
  function refreshHand(): void {
    layoutHand(new Set())
  }
}
