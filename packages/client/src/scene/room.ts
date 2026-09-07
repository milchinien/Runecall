/**
 * Der Raum: Buehne, Tisch, Licht und Partikel.
 *
 * Das ist Stufe 1 aus docs/08-TISCHANSICHT.md -- reine Kulisse, ohne ein
 * einziges Spielelement. Sie kennt weder Karten noch Spieler und laesst sich
 * deshalb fuer sich beurteilen: Steht der Raum, oder steht er nicht?
 *
 * Violett ist gesetzt, aber eine einzige violette Flaeche saehe nach Fehler
 * aus. Tiefe entsteht erst aus mehreren Toenen: kalt und dunkel am Rand,
 * warm und hell zur Mitte, dazu ein paar Lichtpunkte, die langsam steigen.
 */

import {
  AdditiveBlending,
  AmbientLight,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  HemisphereLight,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  Points,
  PerspectiveCamera,
  PlaneGeometry,
  PointsMaterial,
  RingGeometry,
  SRGBColorSpace,
  SpotLight,
  Texture,
} from 'three'
import { SUITS } from '@runecall/engine'

import { SUIT_STYLES } from '../runes.ts'

/**
 * Halbachsen der Tischplatte.
 *
 * Sie ist eine Ellipse, kein Kreis: Ein runder Tisch, von schraeg oben
 * gesehen, waere ohnehin eine Ellipse -- diese hier ist zusaetzlich in der
 * Tiefe gestaucht, damit die gegenueberliegenden Plaetze naeher heranruecken
 * und alle sechs ins Bild passen.
 */
export const TABLE_RX = 4.55
export const TABLE_RZ = 3.15

/** Hoehe der Tischplatte ueber dem Nullpunkt. Alles Weitere rechnet ab hier. */
export const TABLE_Y = 0

export type Room = {
  readonly group: Group
  update(dt: number): void
  /** Passt die Buehne an Kamera und Fenster an. Jedes Bild aufrufbar. */
  fit(camera: PerspectiveCamera): void
  dispose(): void
}

export function createRoom(reducedMotion: boolean, anisotropy: number): Room {
  const group = new Group()
  const disposables: { dispose(): void }[] = []

  const keep = <T extends { dispose(): void }>(thing: T): T => {
    disposables.push(thing)
    return thing
  }

  /* --- Buehne ------------------------------------------------------ */

  const backdrop = createBackdrop()
  group.add(backdrop.mesh)
  disposables.push(backdrop)

  /* --- Tisch ------------------------------------------------------- */

  /**
   * Die Tischplatte ist unbeleuchtet.
   *
   * Beleuchtet bekam sie vom Scheinwerfer einen hellen Fleck und ringsum
   * Schatten -- und damit genau die Silhouette, die sie nicht haben soll: eine
   * dunkle Scheibe vor einer leuchtenden Buehne. Ihr Licht ist deshalb in die
   * Textur gemalt, wie bei den Karten auch. Was die Lampen im Raum noch
   * beleuchten, ist die Zarge.
   */
  const top = new Mesh(
    keep(new CircleGeometry(1, 128)),
    keep(
      new MeshBasicMaterial({
        map: keep(createFeltTexture(anisotropy)),
        toneMapped: false,
      }),
    ),
  )
  top.rotation.x = -Math.PI / 2
  top.scale.set(TABLE_RX, TABLE_RZ, 1)
  top.position.y = TABLE_Y
  group.add(top)

  /**
   * Die Kante, und wie sie verschwindet.
   *
   * Ein scharfer heller Ring gibt dem Tisch eine Silhouette -- und genau die
   * soll er nicht haben: Er steht dann als Scheibe vor der Buehne, statt in
   * ihr zu liegen. Die Kante besteht deshalb aus zwei sehr blassen Schichten,
   * die beide nach aussen auslaufen: ein schmaler Schimmer auf der Kante,
   * damit die Form ueberhaupt lesbar bleibt, und ein breiter Schein weit
   * darueber hinaus, der sich im Hintergrund verliert.
   */
  const rim = new Mesh(
    keep(new RingGeometry(0.978, 1.02, 160)),
    keep(
      new MeshBasicMaterial({
        map: keep(createRimTexture()),
        transparent: true,
        depthWrite: false,
        opacity: 0.5,
      }),
    ),
  )
  rim.rotation.x = -Math.PI / 2
  rim.scale.set(TABLE_RX, TABLE_RZ, 1)
  rim.position.y = TABLE_Y + 0.006
  group.add(rim)

  const halo = new Mesh(
    keep(new RingGeometry(0.9, 1.3, 160)),
    keep(
      new MeshBasicMaterial({
        map: keep(createEdgeTexture()),
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        opacity: 0.55,
      }),
    ),
  )
  halo.rotation.x = -Math.PI / 2
  halo.scale.set(TABLE_RX, TABLE_RZ, 1)
  halo.position.y = TABLE_Y + 0.004
  group.add(halo)

  // Die Zarge gibt der Platte Dicke -- ohne sie schwebt eine Scheibe. Ihr
  // Verlauf faellt nach unten ins Dunkle, damit der Tisch steht und nicht
  // leuchtet.
  const skirt = new Mesh(
    keep(new CylinderGeometry(1, 0.9, 0.5, 128, 1, true)),
    keep(
      new MeshStandardMaterial({
        map: keep(createSkirtTexture()),
        roughness: 0.72,
        metalness: 0.04,
        side: BackSide,
        transparent: true,
        depthWrite: false,
      }),
    ),
  )
  skirt.scale.set(TABLE_RX, 1, TABLE_RZ)
  skirt.position.y = TABLE_Y - 0.25
  group.add(skirt)

  /**
   * Ein Lichtteppich unter dem Tisch.
   *
   * Ohne ihn hoert der Tisch nach unten einfach auf und steht im Nichts. Der
   * weiche Fleck darunter liest sich als das Licht, das an ihm vorbei auf den
   * Boden faellt -- ein Boden, den es gar nicht gibt.
   */
  const pool = new Mesh(
    keep(new CircleGeometry(1, 96)),
    keep(
      new MeshBasicMaterial({
        map: keep(createPoolTexture()),
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        opacity: 0.34,
      }),
    ),
  )
  pool.rotation.x = -Math.PI / 2
  pool.scale.set(TABLE_RX * 1.95, TABLE_RZ * 1.95, 1)
  pool.position.y = TABLE_Y - 0.7
  group.add(pool)

  /* --- Licht ------------------------------------------------------- */

  group.add(new AmbientLight(new Color('#ff3344'), 1.55))
  group.add(new HemisphereLight(new Color('#ffd0b8'), new Color('#780018'), 1.15))

  const key = new SpotLight(new Color('#ffe3bb'), 320, 26, 0.9, 0.95, 2)
  key.position.set(0, 7.6, 1.8)
  key.target.position.set(0, 0, -0.2)
  group.add(key, key.target)

  const rimLeft = new PointLight(new Color('#ff001e'), 480, 34, 1.55)
  rimLeft.position.set(-7, 3.4, -4.5)
  group.add(rimLeft)

  const rimRight = new PointLight(new Color('#ff001e'), 420, 34, 1.55)
  rimRight.position.set(7, 2.6, -4.2)
  group.add(rimRight)

  /* --- Partikel ---------------------------------------------------- */

  const stars = createStars()
  group.add(stars.points)
  disposables.push(stars)

  const motes = createMotes()
  group.add(motes.points)
  disposables.push(motes)

  return {
    group,

    update(dt) {
      // Bei `prefers-reduced-motion` stehen die Lichtpunkte still. Sie
      // verschwinden nicht -- der Raum soll auch dann derselbe Raum sein.
      if (reducedMotion) return
      motes.update(dt)
    },

    fit(camera) {
      backdrop.fit(camera)
    },

    dispose() {
      for (const thing of disposables) thing.dispose()
    },
  }
}

/* ------------------------------------------------------------------ *
 * Buehne und Filz
 * ------------------------------------------------------------------ */

/**
 * Die Buehne.
 *
 * Sie war einmal die Innenseite einer Kugel um den Raum. Das war falsch, und
 * zwar aus einem einzigen Grund: Die Kamera sieht 43 der 360 Grad, also gut
 * ein Neuntel der Texturbreite. Eine Textur von 1024 Bildpunkten wurde damit
 * auf gut 1200 Bildschirmpunkte gezogen -- zehnfach vergroessert. Jeder
 * Rauschpunkt wurde zum Flecken, und die ganze Flaeche sah aus wie grober
 * Stoff.
 *
 * Jetzt ist sie eine ebene Flaeche unmittelbar vor der Kamera, gemalt in
 * Bildkoordinaten statt in Grad. Das darf sie sein, weil die Kamera feststeht:
 * Sie sieht immer dasselbe Stueck Buehne, also gibt es keinen Grund, den Rest
 * einer Kugel mitzuschleppen. Ein Bildpunkt der Textur ist damit ungefaehr
 * ein Bildpunkt am Bildschirm.
 */
type Backdrop = {
  readonly mesh: Mesh
  fit(camera: PerspectiveCamera): void
  dispose(): void
}

/** Abstand der Buehne vor der Kamera. Weit genug hinter allem, was im Raum steht. */
const BACKDROP_AT = 40

/** Aufloesung der gemalten Buehne. Reicht fuer heutige Bildschirme. */
const BACKDROP_W = 2048
const BACKDROP_H = 1152

function createBackdrop(): Backdrop {
  const texture = createBackdropTexture()
  const geometry = new PlaneGeometry(1, 1)
  const material = new MeshBasicMaterial({
    map: texture,
    depthTest: false,
    depthWrite: false,
    // Ohne Tonwertabbildung: Sie ist fuer beleuchtete Gegenstaende gedacht und
    // staucht gerade die hellen Stellen -- also genau das, was hier leuchten
    // soll. Die Buehne ist gemalt, kein Gegenstand.
    toneMapped: false,
  })

  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.renderOrder = -100

  let aspect = 0

  return {
    mesh,

    fit(camera) {
      // Vor der Kamera, quer zur Blickrichtung, gross genug fuer das ganze
      // Bild. Die Kamera steht still; gerechnet wird trotzdem jedes Bild, weil
      // sich mit dem Fenster der Bildwinkel aendert.
      const height = 2 * BACKDROP_AT * Math.tan(((camera.fov / 2) * Math.PI) / 180)
      const width = height * camera.aspect

      mesh.quaternion.copy(camera.quaternion)
      mesh.position
        .set(0, 0, -BACKDROP_AT)
        .applyQuaternion(camera.quaternion)
        .add(camera.position)
      mesh.scale.set(width, height, 1)

      if (Math.abs(camera.aspect - aspect) < 0.0005) return
      aspect = camera.aspect
      coverTexture(texture, camera.aspect, BACKDROP_W / BACKDROP_H)
    },

    dispose() {
      geometry.dispose()
      texture.dispose()
      material.dispose()
    },
  }
}

/**
 * Legt eine Textur formatfuellend auf eine Flaeche.
 *
 * Ohne das wird die gemalte Buehne mit dem Fenster verzerrt: Aus dem
 * leuchtenden Kern wird bei einem breiten Fenster ein liegendes Ei. Statt zu
 * dehnen wird beschnitten -- so bleibt ein gemalter Kreis ein Kreis.
 */
function coverTexture(texture: Texture, wanted: number, own: number): void {
  if (wanted > own) {
    texture.repeat.set(1, own / wanted)
    texture.offset.set(0, (1 - own / wanted) / 2)
  } else {
    texture.repeat.set(wanted / own, 1)
    texture.offset.set((1 - wanted / own) / 2, 0)
  }
  texture.needsUpdate = true
}

function createBackdropTexture(): Texture {
  const canvas = document.createElement('canvas')
  canvas.width = BACKDROP_W
  canvas.height = BACKDROP_H

  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('Kein 2D-Kontext fuer die Buehne')

  ctx.fillStyle = '#d00028'
  ctx.fillRect(0, 0, BACKDROP_W, BACKDROP_H)

  ctx.save()
  ctx.translate(BACKDROP_W * 0.5, BACKDROP_H * CORE_HEIGHT)
  paintCore(ctx)
  ctx.restore()

  paintPatches(ctx, BACKDROP_W, BACKDROP_H)
  paintVignette(ctx, BACKDROP_W, BACKDROP_H)

  // Feine Koernung gegen Streifen. Fein heisst hier wirklich fein: Sie sitzt
  // jetzt auf Bildschirmaufloesung, nicht mehr zehnfach vergroessert.
  addGrain(ctx, BACKDROP_W, BACKDROP_H, 5)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/**
 * Der leuchtende Grund.
 *
 * Nachgemessen an der Vorlage, in deren Farbe umgerechnet. Sie hat drei
 * Eigenschaften, und alle drei zaehlen:
 *
 * - **Eine breite helle Mitte, kein Punkt.** Ueber das erste Drittel des
 *   Verlaufs bleibt es fast gleich hell -- erst danach faellt es ab. Ein
 *   Verlauf, der gleich an der Mitte abfaellt, sieht aus wie ein Scheinwerfer.
 * - **Ein kraeftiger Abfall dahinter.** Von der Mitte zur Ecke geht es auf
 *   etwa ein Viertel der Helligkeit herunter. Das ist der Unterschied, der
 *   dem Bild Tiefe gibt.
 * - **Farbig bis in die Ecke.** In der Vorlage steht dort ein sattes Rot
 *   (122, 1, 8) und kein Grau: Gruen und Blau sind fast auf null. Hier
 *   entsprechend ein sattes Violett -- dunkel, aber nicht entfaerbt.
 *
 * Radial gleich heisst dabei wirklich gleich: In derselben Entfernung von der
 * Mitte sieht es ringsum gleich aus. Was frueher in eine Richtung heller war
 * als in die andere, waren die Facetten -- die sind jetzt zurueckhaltend.
 */
function paintCore(ctx: CanvasRenderingContext2D): void {
  paintGlow(ctx, 0, 0, BACKDROP_H * 1.05, [
    [0.0, 'rgba(255, 255, 255, 1)'],
    [0.08, 'rgba(255, 235, 213, 1)'],
    [0.18, 'rgba(255, 126, 100, 1)'],
    [0.34, 'rgba(255, 32, 48, 1)'],
    [0.56, 'rgba(255, 0, 35, 1)'],
    [0.78, 'rgba(218, 0, 40, 1)'],
    [1.0, 'rgba(174, 0, 39, 1)'],
  ])
}

/**
 * Hellere und dunklere Stellen.
 *
 * Vorher standen hier Facetten: Keile vom Kern nach aussen, mit geraden
 * Kanten. Sie waren als geschliffener Stein gedacht und lasen sich als
 * Strahlen -- eine Richtung war heller als die andere, und das Auge sucht
 * dahinter eine Lichtquelle.
 *
 * Aus demselben Grund sind auch die Ringe um die Mitte weg: Beides sind
 * Formen, die man wiedererkennt, und wo man eine Form erkennt, sucht man einen
 * Grund dafuer.
 *
 * Jetzt sind es weiche Flecken, ueber die ganze Flaeche verstreut, je zur
 * Haelfte heller und dunkler als der Grund. Wo sie liegen, ist gleichgueltig;
 * entscheidend ist, dass keiner eine Kante hat: Jeder laeuft nach aussen auf
 * null aus, sodass zwischen zwei Flecken immer ein Verlauf steht und nie ein
 * Rand. In die Laenge gezogen und verdreht sind sie, damit aus einer Handvoll
 * Kreise kein Muster wird.
 */
function paintPatches(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const count = 30

  for (let i = 0; i < count; i++) {
    const lighter = i % 2 === 0
    const radius = height * (0.2 + Math.random() * 0.42)
    const strength = (0.45 + Math.random() * 0.55) * (lighter ? 0.115 : 0.105)
    const tone = lighter ? '255, 225, 190' : '125, 0, 24'

    ctx.save()
    ctx.globalCompositeOperation = lighter ? 'lighter' : 'source-over'
    ctx.translate(Math.random() * width, Math.random() * height)
    ctx.rotate(Math.random() * Math.PI)
    ctx.scale(1 + Math.random() * 1.5, 0.45 + Math.random() * 0.6)

    paintGlow(ctx, 0, 0, radius, [
      [0, `rgba(${tone}, ${strength})`],
      [0.55, `rgba(${tone}, ${strength * 0.4})`],
      [1, `rgba(${tone}, 0)`],
    ])

    ctx.restore()
  }

  ctx.globalCompositeOperation = 'source-over'
}

/**
 * Der dunkle Rahmen um das Bild.
 *
 * Der Verlauf des Kerns faellt zur Ecke hin ab -- aber gleichmaessig in alle
 * Richtungen, und das reicht nicht: Auf einem breiten Bildschirm liegen die
 * Ecken so weit aussen, dass dort immer noch fast dieselbe Helligkeit steht
 * wie hinter dem Tisch. Das Bild las sich dadurch als eine grosse violette
 * Flaeche mit einer Scheibe darin.
 *
 * Der Rahmen legt Gewicht an die Raender zurueck. Er ist weit aussen, weich
 * und nie ganz schwarz: Farbe bis in die Ecke bleibt die Regel (siehe
 * `paintCore`), er nimmt ihr nur die Helligkeit. Und er sitzt tiefer als der
 * Kern, damit unten -- wo die eigene Hand liegt -- mehr davon ankommt als
 * oben.
 */
function paintVignette(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save()
  ctx.translate(width / 2, height * 0.56)
  // In die Breite gezogen, sonst waere der Rahmen bei einem breiten Fenster
  // oben und unten viel dichter als links und rechts.
  ctx.scale(width / height, 1)

  paintGlow(ctx, 0, 0, height * 0.75, [
    [0.0, 'rgba(110, 0, 22, 0)'],
    [0.52, 'rgba(110, 0, 22, 0)'],
    [0.76, 'rgba(105, 0, 25, 0.1)'],
    [0.92, 'rgba(86, 0, 26, 0.2)'],
    [1.0, 'rgba(62, 0, 24, 0.28)'],
  ])

  ctx.restore()
}

/** Auf welcher Hoehe des Bildes der Kern sitzt -- hinter dem Tisch. */
const CORE_HEIGHT = 0.46

/** Ein weicher runder Fleck. Die Farbstufen kommen von aussen. */
function paintGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  stops: readonly (readonly [number, string])[],
): void {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius)
  for (const [at, colour] of stops) glow.addColorStop(at, colour)
  ctx.fillStyle = glow
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2)
}

/**
 * Streut jedem Bildpunkt ein wenig Helligkeit zu oder ab.
 *
 * Gegen die Streifen, die ein glatter Verlauf auf grosser Flaeche zeigt: Wo
 * zwei benachbarte Farbstufen aufeinandertreffen, sieht man ohne Koernung
 * eine Kante.
 */
function addGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number,
): void {
  const image = ctx.getImageData(0, 0, width, height)
  for (let i = 0; i < image.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * strength
    image.data[i] = clamp255((image.data[i] ?? 0) + noise)
    image.data[i + 1] = clamp255((image.data[i + 1] ?? 0) + noise)
    image.data[i + 2] = clamp255((image.data[i + 2] ?? 0) + noise)
  }
  ctx.putImageData(image, 0, 0)
}

/**
 * Die Tischplatte.
 *
 * Warm erleuchtete Mitte, abgedunkelter Rand -- und dazwischen drei Dinge,
 * die den Filz von einem Farbverlauf unterscheiden:
 *
 * - **Ein Gewebe** aus feinen Linien in beide Diagonalen. Man sieht es nicht
 *   als Muster, man sieht, dass die Flaeche eine Oberflaeche hat.
 * - **Der Runenkreis.** Ein duenner Ring mit den vier Farbrunen, in den Filz
 *   eingelassen wie ein Aufdruck. Er liegt zwischen Mitte und Rand: innen
 *   waere er unter dem Ablagestapel, aussen unter den Faechern.
 * - **Eine Koernung.** Eine mathematisch glatte Flaeche wirkt tot; der Filz
 *   braucht ein wenig Unruhe, damit das Licht etwas zu treffen hat.
 *
 * Die Textur sitzt auf einer Kreisflaeche, die zur Ellipse gestreckt wird --
 * ein Kreis hier wird auf dem Tisch also zur Ellipse, gleichlaufend mit der
 * Kante. Genau so soll der Runenkreis liegen.
 */
/**
 * Wie gross die Filztextur ist -- und warum so gross.
 *
 * Die Platte fuellt im Bild gut 1150 Punkte in der Breite, auf einem
 * feinen Bildschirm also gut 2300 Geraetepunkte. Mit 512 Bildpunkten wurde
 * die Textur damit vierfach vergroessert: Jede gezeichnete Linie wurde vier
 * Punkte breit, jedes Koernchen ein Fleck, und die ganze Platte sah aus wie
 * ein Teppich. Bei 2048 kommt ungefaehr ein Texturpunkt auf einen
 * Geraetepunkt.
 *
 * Alles, was hier gezeichnet wird, rechnet in Anteilen von `size` -- bis auf
 * Strichstaerken. Die stehen in Bildpunkten und muessen mit `px`
 * mitwachsen, sonst werden sie beim Vergroessern der Textur zu Haaren.
 */
const FELT_SIZE = 2048

function createFeltTexture(anisotropy: number): Texture {
  const size = FELT_SIZE
  const px = size / 512
  const middle = size / 2
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('Kein 2D-Kontext fuer die Tischplatte')

  ctx.fillStyle = '#831c38'
  ctx.fillRect(0, 0, size, size)

  const glow = ctx.createRadialGradient(middle, middle, 0, middle, middle, middle)
  // Die aeusseren Stufen laufen auf den Ton der Buehne zu, nicht ins Schwarze:
  // Der Rand der Platte soll dort, wo er den Hintergrund trifft, moeglichst
  // wenig Unterschied machen.
  // Ein wenig dunkler als die Buehne ringsum, in derselben Farbe. So bleibt
  // der Tisch als Flaeche lesbar, ohne sich als Scheibe davorzustellen.
  glow.addColorStop(0.0, '#e94a50')
  glow.addColorStop(0.34, '#d93648')
  glow.addColorStop(0.7, '#b52240')
  glow.addColorStop(0.88, '#961c3a')
  glow.addColorStop(1.0, '#7e1833')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, size, size)

  paintDye(ctx, size)
  paintWeave(ctx, size, px)
  paintRays(ctx, size)
  paintRuneCircle(ctx, size, px)
  paintBorder(ctx, size, px)
  paintFuzz(ctx, size)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace

  // Wie bei der Kartentafel (atlas.ts): Der Tisch liegt flach und wird nach
  // hinten stark gestaucht. Ohne anisotrope Filterung verwischt genau der
  // Teil, in dem der Ablagestapel liegt.
  texture.anisotropy = anisotropy
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true

  return texture
}

/**
 * Die Faerbung: grosse, sehr weiche Schwankungen im Ton.
 *
 * Ein Farbverlauf allein ist mathematisch glatt, und glatt sieht nach
 * Farbfeld aus, nicht nach Stoff. Gefaerbter Filz ist nie ganz gleichmaessig
 * -- an einer Stelle hat er mehr Farbe angenommen als an der anderen. Die
 * Flecken sind absichtlich riesig und blass: Man soll sie nicht als Flecken
 * sehen, sondern die Flaeche nur nicht mehr als gleichmaessig lesen.
 */
function paintDye(ctx: CanvasRenderingContext2D, size: number): void {
  for (let i = 0; i < 22; i++) {
    const lighter = i % 2 === 0
    const radius = size * (0.12 + Math.random() * 0.3)
    const strength = (0.35 + Math.random() * 0.65) * 0.05
    const tone = lighter ? '226, 190, 255' : '58, 20, 104'

    ctx.save()
    ctx.globalCompositeOperation = lighter ? 'lighter' : 'source-over'
    ctx.translate(Math.random() * size, Math.random() * size)
    ctx.rotate(Math.random() * Math.PI)
    ctx.scale(1 + Math.random(), 0.6 + Math.random() * 0.5)

    paintGlow(ctx, 0, 0, radius, [
      [0, `rgba(${tone}, ${strength})`],
      [0.6, `rgba(${tone}, ${strength * 0.35})`],
      [1, `rgba(${tone}, 0)`],
    ])

    ctx.restore()
  }

  ctx.globalCompositeOperation = 'source-over'
}

/**
 * Der Strich des Gewebes.
 *
 * Zwei Scharen feiner Linien, dichter und blasser als frueher. Dichter,
 * weil sie bei 2048 sonst als Streifen lesbar wuerden; blasser, weil der
 * Flaum darueber ohnehin die Oberflaeche macht. Was bleibt, ist eine
 * Richtung im Stoff -- man sieht kein Muster, man sieht, dass die Flaeche
 * eine hat.
 */
function paintWeave(ctx: CanvasRenderingContext2D, size: number, px: number): void {
  ctx.save()
  ctx.lineWidth = px

  for (const [direction, alpha] of [
    [1, 0.03],
    [-1, 0.02],
  ] as const) {
    ctx.strokeStyle = `rgba(226, 206, 255, ${alpha})`
    ctx.beginPath()
    for (let offset = -size; offset < size * 2; offset += 9 * px) {
      ctx.moveTo(offset, 0)
      ctx.lineTo(offset + direction * size, size)
    }
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * Der Flaum: Rauschen auf Texturpunktgroesse, gekachelt aufgetragen.
 *
 * Frueher stand hier `addGrain` -- ein Durchgang ueber jeden Bildpunkt. Bei
 * 512 ging das; bei 2048 sind es vier Millionen Punkte, und der Raum haette
 * beim Start sichtbar gestockt. Stattdessen wird ein kleines Stueck Rauschen
 * gewuerfelt und als Muster ueber die ganze Flaeche gelegt.
 *
 * Aufgetragen wird es mit `overlay` gegen Mittelgrau: Wo das Rauschen genau
 * mittelgrau ist, aendert sich nichts, heller hellt auf, dunkler dunkelt ab.
 * Damit bleibt die gemalte Beleuchtung erhalten -- ein Rauschen, das einfach
 * darueberliegt, wuerde die dunklen Stellen aufhellen und die Platte flau
 * machen.
 *
 * Die Kachel ist bewusst gross (512): Bei einer kleinen sieht man die
 * Wiederholung als Raster, sobald das Auge einmal darauf gestossen ist.
 */
function paintFuzz(ctx: CanvasRenderingContext2D, size: number): void {
  const tile = document.createElement('canvas')
  tile.width = 512
  tile.height = 512

  const grain = tile.getContext('2d')
  if (grain === null) return

  const image = grain.createImageData(tile.width, tile.height)
  for (let i = 0; i < image.data.length; i += 4) {
    // 44 ist so gewaehlt, dass am Ende ungefaehr dieselbe Staerke herauskommt
    // wie bei der frueheren Koernung (13 von 255) -- nur eben auf einem
    // Viertel der Kantenlaenge, also viermal so fein. Wem der Filz zu glatt
    // oder zu rau ist, dreht an dieser Zahl.
    const noise = 128 + (Math.random() - 0.5) * 44
    image.data[i] = noise
    image.data[i + 1] = noise
    image.data[i + 2] = noise
    image.data[i + 3] = 255
  }
  grain.putImageData(image, 0, 0)

  const pattern = ctx.createPattern(tile, 'repeat')
  if (pattern === null) return

  ctx.save()
  ctx.globalCompositeOperation = 'overlay'
  ctx.globalAlpha = 0.5
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, size, size)
  ctx.restore()
}

/**
 * Ein schwacher Stern aus der Mitte.
 *
 * Zwoelf Strahlen, kaum heller als der Filz selbst. Sie geben der Platte eine
 * Mitte, ohne dass etwas darauf gezeichnet waere -- was in der Mitte liegt,
 * ist der Ablagestapel, und der soll der einzige Gegenstand dort bleiben.
 */
function paintRays(ctx: CanvasRenderingContext2D, size: number): void {
  const middle = size / 2
  const rays = 12

  ctx.save()
  ctx.translate(middle, middle)

  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2
    const wedge = Math.PI / rays / 1.9

    const fade = ctx.createRadialGradient(0, 0, size * 0.06, 0, 0, size * 0.46)
    fade.addColorStop(0, 'rgba(198, 164, 255, 0.055)')
    fade.addColorStop(0.6, 'rgba(180, 140, 250, 0.022)')
    fade.addColorStop(1, 'rgba(160, 120, 240, 0)')

    ctx.fillStyle = fade
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, size * 0.46, angle - wedge, angle + wedge)
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()
}

/**
 * Der Rand: zwei Linien und eine Reihe kurzer Striche dazwischen.
 *
 * Das ist die Borte, die Spieltische gern haben. Sie liegt weit aussen, wo
 * ohnehin nichts gespielt wird, und gibt der Platte eine Fassung -- ohne sie
 * ist der Filz eine Flaeche, die irgendwann aufhoert.
 */
function paintBorder(ctx: CanvasRenderingContext2D, size: number, px: number): void {
  const middle = size / 2
  const outer = size * 0.468
  const inner = size * 0.436

  ctx.save()
  ctx.translate(middle, middle)
  ctx.strokeStyle = 'rgba(206, 178, 252, 0.19)'
  ctx.lineWidth = 1.4 * px

  for (const radius of [outer, inner]) {
    ctx.beginPath()
    ctx.arc(0, 0, radius, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(206, 178, 252, 0.12)'
  ctx.lineWidth = 1.2 * px
  ctx.beginPath()
  for (let i = 0; i < 72; i++) {
    const angle = (i / 72) * Math.PI * 2
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
  }
  ctx.stroke()
  ctx.restore()
}

/**
 * Der Runenkreis: ein Ring, vier Runen, alles nur angedeutet.
 *
 * Die Runen sind dieselben Linienzuege, die auch auf den Karten stehen
 * (`runes.ts`) -- eine zweite Zeichnung waere eine zweite Wahrheit. Jede
 * steht aufrecht zu ihrem Platz auf dem Ring, also mitgedreht.
 */
function paintRuneCircle(ctx: CanvasRenderingContext2D, size: number, px: number): void {
  const middle = size / 2
  const radius = size * 0.355

  ctx.save()
  ctx.strokeStyle = 'rgba(214, 186, 255, 0.22)'
  ctx.lineWidth = 1.6 * px
  ctx.beginPath()
  ctx.arc(middle, middle, radius, 0, Math.PI * 2)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(214, 186, 255, 0.12)'
  ctx.lineWidth = px
  ctx.beginPath()
  ctx.arc(middle, middle, radius - 13 * px, 0, Math.PI * 2)
  ctx.stroke()

  // Die Rune ist fuer eine Flaeche von 10 x 16 gezeichnet; hier wird sie auf
  // etwa 34 Bildpunkte Hoehe gebracht und um ihren Mittelpunkt gedreht.
  const scale = (34 / 16) * px
  ctx.strokeStyle = 'rgba(226, 206, 255, 0.38)'
  ctx.lineWidth = (1.7 * px) / scale
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  SUITS.forEach((suit, index) => {
    const angle = (index / SUITS.length) * Math.PI * 2
    ctx.save()
    ctx.translate(middle + Math.sin(angle) * radius, middle - Math.cos(angle) * radius)
    ctx.rotate(angle)
    ctx.scale(scale, scale)
    ctx.translate(-5, -8)
    ctx.stroke(new Path2D(SUIT_STYLES[suit].runePath))
    ctx.restore()
  })

  ctx.restore()
}

/**
 * Der Schein um die Tischkante.
 *
 * Der Ring bildet seine Textur von innen nach aussen ab -- links ist die
 * Innenkante, rechts die Aussenkante. Der Schein sitzt knapp innerhalb der
 * Tischkante und laeuft nach aussen lang aus: Er soll nicht die Kante
 * nachzeichnen, sondern sie in den Hintergrund hinein aufloesen.
 */
function createEdgeTexture(): Texture {
  const width = 256
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = 4

  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('Kein 2D-Kontext fuer die Tischkante')

  const gradient = ctx.createLinearGradient(0, 0, width, 0)
  gradient.addColorStop(0.0, 'rgba(112, 74, 176, 0)')
  gradient.addColorStop(0.14, 'rgba(132, 92, 200, 0.26)')
  gradient.addColorStop(0.2, 'rgba(186, 148, 246, 0.4)')
  gradient.addColorStop(0.3, 'rgba(146, 96, 216, 0.2)')
  gradient.addColorStop(0.55, 'rgba(118, 70, 190, 0.075)')
  gradient.addColorStop(1.0, 'rgba(96, 54, 168, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, 4)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** Der Schimmer auf der Kante selbst: in der Mitte am hellsten, beidseitig aus. */
function createRimTexture(): Texture {
  const width = 64
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = 4

  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('Kein 2D-Kontext fuer den Kantenschimmer')

  const gradient = ctx.createLinearGradient(0, 0, width, 0)
  gradient.addColorStop(0.0, 'rgba(196, 164, 246, 0)')
  gradient.addColorStop(0.5, 'rgba(214, 188, 255, 0.85)')
  gradient.addColorStop(1.0, 'rgba(196, 164, 246, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, 4)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** Die Zarge: oben noch beleuchtet, unten fast schwarz. */
function createSkirtTexture(): Texture {
  const height = 64
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('Kein 2D-Kontext fuer die Zarge')

  // Nach unten wird die Zarge nicht nur dunkler, sondern durchsichtig. Ein
  // sauber abgeschnittener Rand waere wieder eine Silhouette; so laeuft der
  // Tisch nach unten in die Buehne aus.
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0.0, 'rgba(78, 46, 120, 1)')
  gradient.addColorStop(0.24, 'rgba(52, 30, 84, 0.95)')
  gradient.addColorStop(0.62, 'rgba(30, 17, 52, 0.6)')
  gradient.addColorStop(0.86, 'rgba(18, 10, 34, 0.22)')
  gradient.addColorStop(1.0, 'rgba(13, 7, 25, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 4, height)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

/** Der Lichtteppich unter dem Tisch: in der Mitte satt, nach aussen nichts. */
function createPoolTexture(): Texture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('Kein 2D-Kontext fuer den Lichtteppich')

  paintGlow(ctx, size / 2, size / 2, size / 2, [
    [0.0, 'rgba(108, 52, 208, 0.5)'],
    [0.42, 'rgba(76, 34, 158, 0.2)'],
    [0.75, 'rgba(50, 22, 116, 0.06)'],
    [1.0, 'rgba(34, 14, 86, 0)'],
  ])

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

const clamp255 = (value: number): number => (value < 0 ? 0 : value > 255 ? 255 : value)

/* ------------------------------------------------------------------ *
 * Partikel
 * ------------------------------------------------------------------ */

const STAR_COUNT = 600

/**
 * Sterne, weit hinten und unbewegt.
 *
 * Sie sind der feine Teil der Buehne. In die Textur der Kugel gehoeren sie
 * nicht: Die wird so stark vergroessert, dass aus einem Bildpunkt am
 * Bildschirm ein gutes Dutzend wird -- ein gemalter Stern waere ein Klecks.
 * Als eigene Punkte bleiben sie scharf, egal wie nah man hinsieht.
 *
 * Sie stehen still. Die Bewegung im Raum machen die Lichtpunkte weiter vorn;
 * ein Sternenhimmel, der mitwandert, saehe aus wie Bildrauschen.
 */
function createStars(): Motes {
  const geometry = new BufferGeometry()
  const positions = new Float32Array(STAR_COUNT * 3)
  const colours = new Float32Array(STAR_COUNT * 3)

  const cool = new Color('#9fb4ff')
  const warm = new Color('#ffd9f0')
  const tone = new Color()

  for (let i = 0; i < STAR_COUNT; i++) {
    // Gleichmaessig auf einer Kugelschale, aber nur ueber der Blickhoehe --
    // unter dem Tisch sieht sie ohnehin niemand.
    const angle = Math.random() * Math.PI * 2
    const up = Math.random() ** 1.5
    const radius = 26 + Math.random() * 9
    const ring = Math.sqrt(1 - up * up)

    positions[i * 3] = Math.sin(angle) * ring * radius
    positions[i * 3 + 1] = 2 + up * radius * 0.85
    positions[i * 3 + 2] = Math.cos(angle) * ring * radius

    tone.copy(cool).lerp(warm, Math.random())
    const brightness = (0.2 + Math.random() ** 2 * 0.8) * 0.45
    colours[i * 3] = tone.r * brightness
    colours[i * 3 + 1] = tone.g * brightness
    colours[i * 3 + 2] = tone.b * brightness
  }

  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('color', new BufferAttribute(colours, 3))

  const material = new PointsMaterial({
    size: 0.5,
    map: createMoteTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    sizeAttenuation: true,
  })

  const points = new Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = -3

  return {
    points,
    update() {},
    dispose() {
      geometry.dispose()
      material.map?.dispose()
      material.dispose()
    },
  }
}

const MOTE_COUNT = 340
const MOTE_TOP = 7.5

type Motes = {
  readonly points: Points
  update(dt: number): void
  dispose(): void
}

/**
 * Langsam steigende Lichtpunkte hinter den Sitzplaetzen.
 *
 * Sie stehen in einem Ring ausserhalb des Tisches, nicht ueber ihm: Vor den
 * Spielern haetten sie nichts zu suchen, hinter ihnen geben sie dem Raum
 * Tiefe. Groesse und Helligkeit sind gestreut, sonst sieht man ein Raster.
 */
function createMotes(): Motes {
  const geometry = new BufferGeometry()
  const positions = new Float32Array(MOTE_COUNT * 3)
  const colours = new Float32Array(MOTE_COUNT * 3)
  const speeds = new Float32Array(MOTE_COUNT)

  const warm = new Color('#ffd9a0')
  const cool = new Color('#b48cff')
  const tone = new Color()

  for (let i = 0; i < MOTE_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2
    const radius = 5.6 + Math.random() * 5.4

    positions[i * 3] = Math.sin(angle) * radius * 1.25
    positions[i * 3 + 1] = Math.random() * MOTE_TOP
    positions[i * 3 + 2] = Math.cos(angle) * radius

    tone.copy(cool).lerp(warm, Math.random() ** 2)
    const brightness = 0.35 + Math.random() * 0.65
    colours[i * 3] = tone.r * brightness
    colours[i * 3 + 1] = tone.g * brightness
    colours[i * 3 + 2] = tone.b * brightness

    speeds[i] = 0.12 + Math.random() * 0.42
  }

  const position = new BufferAttribute(positions, 3)
  geometry.setAttribute('position', position)
  geometry.setAttribute('color', new BufferAttribute(colours, 3))

  // `PointsMaterial` kennt nur eine Groesse fuer alle Punkte. Die geforderte
  // Streuung -- "unterschiedlich gross und hell" -- kommt deshalb aus der
  // Entfernung und der Helligkeit: Punkte weiter hinten sind kleiner, und die
  // Helligkeit ist je Punkt gewuerfelt. Aus dem Bild heraus liest sich das
  // wie zwei verschiedene Streuungen.
  const material = new PointsMaterial({
    size: 0.13,
    map: createMoteTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    sizeAttenuation: true,
  })

  const points = new Points(geometry, material)
  points.frustumCulled = false
  points.renderOrder = -2

  return {
    points,

    update(dt) {
      for (let i = 0; i < MOTE_COUNT; i++) {
        const index = i * 3 + 1
        let y = (positions[index] ?? 0) + (speeds[i] ?? 0) * dt
        if (y > MOTE_TOP) y -= MOTE_TOP
        positions[index] = y
      }
      position.needsUpdate = true
    },

    dispose() {
      geometry.dispose()
      material.map?.dispose()
      material.dispose()
    },
  }
}

/** Ein weicher runder Punkt -- ohne ihn waeren die Partikel Quadrate. */
function createMoteTexture(): Texture {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const ctx = canvas.getContext('2d')
  if (ctx === null) throw new Error('Kein 2D-Kontext fuer die Partikel')

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.62)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}
