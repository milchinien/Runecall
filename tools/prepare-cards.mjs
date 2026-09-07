/**
 * Macht aus dem gelieferten Bildmaterial spielfertige Karten.
 *
 * Die Kartenmotive kommen als Boegen mit mehreren Karten nebeneinander,
 * getrennt durch durchsichtige Luecken, und mit nichtssagenden Dateinamen.
 * Dieses Werkzeug schneidet sie auseinander, benennt sie nach dem Wert, den
 * sie tragen, und legt sie in einheitlicher Groesse im Client ab.
 *
 * Welcher Bogen welche Karten enthaelt, steht in `sheets.json` neben den
 * Bildern -- der Dateiname verraet es nicht, also muss es jemand einmal
 * aufschreiben. Kommt neues Material dazu, wird dort ergaenzt.
 *
 * Neben den Einzelbildern entsteht eine gemeinsame Bildtafel (`atlas.webp`).
 * Die Tischansicht holt sich daraus ihre Ausschnitte: 61 Motive einzeln als
 * Textur waeren 61 Texturwechsel je Bild, aus einer Tafel wird daraus einer.
 * Die Einzelbilder bleiben trotzdem -- die flache Fassung und die
 * Kartenprüfung brauchen sie.
 *
 *   npm run cards              aufbereiten
 *   npm run cards -- --kontakt zusaetzlich Kontaktbögen zum Nachprüfen
 *
 * Was fehlt, fehlt: für Karten ohne Bild zeichnet der Client weiterhin
 * seine typografische Fassung. Das Spiel bleibt also jederzeit vollständig.
 */

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const SET = 'Standard Set'
const SET_ID = 'standard'
const SOURCE = path.join('assets/cards', SET)
const TARGET = path.join('packages/client/public/cards', SET_ID)
const MANIFEST = 'packages/client/src/cardart.generated.ts'

/** Zielmass. Etwa das Vierfache der Anzeigegroesse, damit es auf scharfen Bildschirmen haelt. */
const OUT_W = 384
const OUT_H = 600

/**
 * Raster der gemeinsamen Bildtafel.
 *
 * Jede Zelle traegt ringsum eine durchsichtige Luecke. Ohne sie zieht die
 * Grafikkarte beim Verkleinern Farbe aus der Nachbarzelle herueber -- eine
 * schraeg stehende Karte bekaeme dann einen fremden Saum.
 */
const ATLAS_COLUMNS = 8
const ATLAS_CELL = { width: 256, height: 400, gutter: 4 }
const ATLAS_PITCH_X = ATLAS_CELL.width + 2 * ATLAS_CELL.gutter
const ATLAS_PITCH_Y = ATLAS_CELL.height + 2 * ATLAS_CELL.gutter

const SUITS = ['red', 'yellow', 'green', 'blue']

/* ------------------------------------------------------------------ *
 * Boegen zerlegen
 * ------------------------------------------------------------------ */

/** Zusammenhaengende Bereiche einer 0/1-Maske; kurze Luecken trennen nicht. */
function runs(mask, minGap) {
  const found = []
  let start = -1
  let gap = 0

  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 1) {
      if (start === -1) start = i
      gap = 0
    } else if (start !== -1) {
      gap++
      if (gap >= minGap) {
        found.push([start, i - gap])
        start = -1
        gap = 0
      }
    }
  }
  if (start !== -1) found.push([start, mask.length - 1 - gap])
  return found
}

/**
 * Findet die einzelnen Karten auf einem Bogen.
 *
 * Schmale Streifen werden verworfen: An manchen Boegen haengt ein paar Pixel
 * breiter Rest, den die Trennung sonst fuer eine eigene Karte hielte.
 */
async function findCards(file) {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info

  const columns = new Uint8Array(width)
  const rows = new Uint8Array(height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = channels === 4 ? data[(y * width + x) * channels + 3] : 255
      if (alpha > 8) {
        columns[x] = 1
        rows[y] = 1
      }
    }
  }

  const vertical = runs(rows, Math.max(12, Math.round(height * 0.02)))
  const top = vertical[0]?.[0] ?? 0
  const bottom = vertical.at(-1)?.[1] ?? height - 1

  const spans = runs(columns, Math.max(12, Math.round(width * 0.02)))
  const widest = Math.max(...spans.map(([l, r]) => r - l + 1))

  return spans
    .filter(([l, r]) => r - l + 1 >= widest * 0.4)
    .map(([left, right]) => ({
      left,
      top,
      width: right - left + 1,
      height: bottom - top + 1,
    }))
}

/** Einheitliche Groesse, durchsichtiger Rand, WebP. */
async function writeCard(pipeline, name) {
  await pipeline
    .resize(OUT_W, OUT_H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(path.join(TARGET, `${name}.webp`))
}

/* ------------------------------------------------------------------ *
 * Gemeinsame Bildtafel
 * ------------------------------------------------------------------ */

/**
 * Mittlere Farbe des aeusseren Randes eines Motivs.
 *
 * Der Kartenkoerper in der Szene hat Dicke, also vier schmale Kanten. Weiss
 * waeren sie ein greller Strich um jedes Motiv; mit der Randfarbe des Bildes
 * sehen sie aus wie der Schnitt durch dieselbe Karte. Durchsichtige Pixel
 * zaehlen nicht mit -- viele Motive haben abgerundete Ecken.
 */
async function edgeColour(buffer) {
  const w = 32
  const h = 50
  const data = await sharp(buffer).resize(w, h, { fit: 'fill' }).ensureAlpha().raw().toBuffer()

  let r = 0
  let g = 0
  let b = 0
  let weight = 0

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x > 1 && y > 1 && x < w - 2 && y < h - 2) continue
      const i = (y * w + x) * 4
      const alpha = data[i + 3] / 255
      if (alpha < 0.5) continue
      r += data[i] * alpha
      g += data[i + 1] * alpha
      b += data[i + 2] * alpha
      weight += alpha
    }
  }

  if (weight === 0) return '#2a2333'
  return `#${[r, g, b].map((v) => Math.round(v / weight).toString(16).padStart(2, '0')).join('')}`
}

/**
 * Setzt alle Motive zu einer Tafel zusammen und meldet, wo jedes sitzt.
 *
 * Die Reihenfolge ist die sortierte Liste der Kennungen -- damit liegt
 * dieselbe Karte bei gleichem Material immer auf demselben Platz, und ein
 * erneuter Lauf erzeugt keine unnoetige Aenderung.
 */
async function buildAtlas(ids) {
  const rows = Math.ceil(ids.length / ATLAS_COLUMNS)
  const frames = {}
  const tiles = []

  for (const [index, id] of ids.entries()) {
    const col = index % ATLAS_COLUMNS
    const row = Math.floor(index / ATLAS_COLUMNS)

    const tile = await sharp(path.join(TARGET, `${id}.webp`))
      .resize(ATLAS_CELL.width, ATLAS_CELL.height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer()

    tiles.push({
      input: tile,
      left: col * ATLAS_PITCH_X + ATLAS_CELL.gutter,
      top: row * ATLAS_PITCH_Y + ATLAS_CELL.gutter,
    })

    frames[id] = { col, row, edge: await edgeColour(tile) }
  }

  await sharp({
    create: {
      width: ATLAS_COLUMNS * ATLAS_PITCH_X,
      height: rows * ATLAS_PITCH_Y,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(tiles)
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(path.join(TARGET, 'atlas.webp'))

  return { frames, rows }
}

/**
 * Die Rueckseite bekommt einen hellen Rand.
 *
 * Der Grund steht am Tisch: Die Mitspieler halten ihre Blaetter stark
 * ueberlappend, sichtbar ist je Karte nur ein schmaler Streifen. Ohne Rand
 * gehen sechs dunkle Streifen ineinander ueber und das Blatt wird ein Klotz --
 * mit Rand liest man jede Karte einzeln. Genau das leistet der weisse Rand der
 * bekannten Vorlage, und er ist der einzige Grund, warum unsere Blaetter
 * daneben noch anders aussahen.
 *
 * Das Motiv selbst bleibt unangetastet: Es wird nur verkleinert und in den
 * Rahmen gesetzt. Die Ecken werden dabei mitgerundet, sonst schaut das
 * Rechteck an den Rundungen ueber den Rahmen hinaus.
 */
const BACK_BORDER = 20
const BACK_RADIUS = 42

/**
 * Die Rueckseite wird gezeichnet, nicht geliefert.
 *
 * Das gelieferte Motiv (fast schwarz, violetter Rand) stammt aus der Zeit des
 * dunklen Salons. Auf dem roten Arcade-Tisch las es sich als Loch im Bild --
 * die Blaetter der Mitspieler bestehen fast nur aus Rueckseiten, also praegt
 * dieses eine Motiv ihren ganzen Auftritt. Jetzt traegt es die Sprache der
 * Bedienschicht: violetter Verlauf wie die Schilder, ein Goldring als Siegel,
 * darin die vier Runen in den Spielfarben.
 */
function arcadeBack() {
  const rune = (path, colour, x, y, scale) =>
    `<g transform="translate(${x - 5 * scale} ${y - 8 * scale}) scale(${scale})">
       <path d="${path}" fill="none" stroke="${colour}" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round"/>
     </g>`

  // Anordnung wie auf dem alten Motiv: Berkano oben, Kenaz links, Sowilo
  // rechts, Laguz unten -- die Farben decken sich mit der Arena am Tisch.
  const runes = [
    rune('M2.5 2 L2.5 14 M2.5 2 L7.5 5 L2.5 8 M2.5 8 L7.5 11 L2.5 14', '#2db56a', 192, 234, 4.1),
    rune('M7.5 2 L2.5 8 L7.5 14', '#ed3b48', 126, 300, 4.1),
    rune('M7.5 2 L3 6 L7 10 L2.5 14', '#f4c62d', 258, 300, 4.1),
    rune('M3 2 L3 14 M3 2 L7.5 6', '#347de5', 192, 366, 4.1),
  ].join('')

  return Buffer.from(`<svg width="${OUT_W}" height="${OUT_H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0.7" y2="1">
        <stop offset="0" stop-color="#4b3a79"/>
        <stop offset="1" stop-color="#221a45"/>
      </linearGradient>
      <pattern id="stripes" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <rect width="18" height="46" fill="rgba(255,255,255,0.05)"/>
      </pattern>
    </defs>
    <rect width="${OUT_W}" height="${OUT_H}" fill="url(#bg)"/>
    <rect width="${OUT_W}" height="${OUT_H}" fill="url(#stripes)"/>
    <rect x="16" y="16" width="${OUT_W - 32}" height="${OUT_H - 32}" rx="26"
      fill="none" stroke="rgba(255,255,255,0.30)" stroke-width="5"/>
    <circle cx="192" cy="300" r="128" fill="rgba(255,255,255,0.07)"/>
    <circle cx="192" cy="300" r="128" fill="none" stroke="#ffd43b" stroke-width="9"/>
    <circle cx="192" cy="300" r="108" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="3"/>
    ${runes}
  </svg>`)
}

async function writeBack(file) {
  const width = OUT_W - 2 * BACK_BORDER
  const height = OUT_H - 2 * BACK_BORDER

  const rounded = (w, h, r) =>
    Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`)

  const inner = await sharp(file)
    .resize(width, height, { fit: 'cover' })
    .composite([{ input: rounded(width, height, BACK_RADIUS - 8), blend: 'dest-in' }])
    .png()
    .toBuffer()

  await sharp({
    create: { width: OUT_W, height: OUT_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: rounded(OUT_W, OUT_H, BACK_RADIUS), blend: 'over' },
      { input: inner, left: BACK_BORDER, top: BACK_BORDER },
    ])
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(path.join(TARGET, 'back.webp'))
}

/* ------------------------------------------------------------------ *
 * Ablauf
 * ------------------------------------------------------------------ */

const sheets = JSON.parse(await readFile(path.join(SOURCE, 'sheets.json'), 'utf8'))

await rm(TARGET, { recursive: true, force: true })
await mkdir(TARGET, { recursive: true })

const written = []
const missing = []

// --- Zahlenkarten ---
for (const suit of SUITS) {
  const plan = sheets[suit] ?? {}
  const done = new Set()

  for (const [file, values] of Object.entries(plan)) {
    const source = path.join(SOURCE, suit, file)
    const cards = await findCards(source)

    if (cards.length !== values.length) {
      console.warn(
        `  ! ${suit}/${file}: ${cards.length} Karten gefunden, ${values.length} erwartet — übersprungen`,
      )
      continue
    }

    for (const [index, value] of values.entries()) {
      const id = `${suit}-${value}`
      await writeCard(sharp(source).extract(cards[index]), id)
      written.push(id)
      done.add(value)
    }
  }

  for (let value = 1; value <= 13; value++) {
    if (!done.has(value)) missing.push(`${suit}-${value}`)
  }
}

// --- Magier und Narren: je eine Fassung pro Farbe ---
for (const kind of ['mage', 'jester']) {
  const files = await readdir(path.join(SOURCE, kind))

  for (const [index, suit] of SUITS.entries()) {
    const file = files.find((f) => f.toLowerCase().includes(suit))
    const id = `${kind}-${index + 1}` // deckt sich mit den IDs der Engine

    if (file === undefined) {
      missing.push(id)
      continue
    }
    await writeCard(sharp(path.join(SOURCE, kind, file)), id)
    written.push(id)
  }
}

// --- Rückseite: gezeichnet, das gelieferte Motiv unter backside/ ruht ---
await writeBack(arcadeBack())
written.push('back')

// --- Gemeinsame Bildtafel ---
const ids = written.slice().sort()
const { frames, rows } = await buildAtlas(ids)

// --- Verzeichnis für den Client ---
const artEntries = ids.map((id) => `  '${id}': '/cards/${SET_ID}/${id}.webp',`).join('\n')

const frameEntries = ids
  .map((id) => {
    const frame = frames[id]
    return `  '${id}': { col: ${frame.col}, row: ${frame.row}, edge: '${frame.edge}' },`
  })
  .join('\n')

await writeFile(
  MANIFEST,
  `/**
 * Erzeugt von tools/prepare-cards.mjs -- nicht von Hand ändern.
 *
 * Zweierlei steht hier: das Verzeichnis der einzelnen Kartenbilder, und die
 * Aufteilung der gemeinsamen Bildtafel, aus der die Tischansicht ihre
 * Ausschnitte holt. Karten, die hier fehlen, zeichnet der Client
 * typografisch.
 */

export const CARD_ART_SET = '${SET_ID}'

export const CARD_ART: Readonly<Record<string, string>> = {
${artEntries}
}

/** Die gemeinsame Bildtafel und ihr Raster. */
export const CARD_ATLAS = '/cards/${SET_ID}/atlas.webp'
export const CARD_ATLAS_COLUMNS = ${ATLAS_COLUMNS}
export const CARD_ATLAS_ROWS = ${rows}
export const CARD_ATLAS_CELL = { width: ${ATLAS_CELL.width}, height: ${ATLAS_CELL.height}, gutter: ${ATLAS_CELL.gutter} } as const

export type CardFrame = {
  /** Spalte und Zeile der Karte auf der Tafel. */
  readonly col: number
  readonly row: number
  /** Mittlere Randfarbe des Motivs -- faerbt die Kanten des Kartenkoerpers. */
  readonly edge: string
}

export const CARD_FRAMES: Readonly<Record<string, CardFrame>> = {
${frameEntries}
}
`,
)

console.log(`${written.length} Karten nach ${TARGET}`)
console.log(`Bildtafel: ${ATLAS_COLUMNS} x ${rows} Zellen`)
if (missing.length > 0) {
  console.log(`Ohne Bild (${missing.length}): ${missing.join(', ')}`)
}

/* ------------------------------------------------------------------ *
 * Kontaktbögen zum Nachprüfen
 * ------------------------------------------------------------------ */

if (process.argv.includes('--kontakt')) {
  const dir = 'assets/.kontakt'
  await mkdir(dir, { recursive: true })

  for (const suit of SUITS) {
    const cards = []
    for (let value = 1; value <= 13; value++) {
      const file = path.join(TARGET, `${suit}-${value}.webp`)
      try {
        cards.push({ value, buffer: await sharp(file).resize(150, 234).png().toBuffer() })
      } catch {
        // kein Bild fuer diesen Wert
      }
    }
    if (cards.length === 0) continue

    const width = cards.length * 156 + 6
    await sharp({
      create: { width, height: 274, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .composite(
        cards.flatMap(({ value, buffer }, i) => [
          { input: buffer, left: 6 + i * 156, top: 6 },
          {
            input: Buffer.from(
              `<svg width="150" height="30"><text x="75" y="24" font-family="sans-serif"
                 font-size="22" font-weight="700" text-anchor="middle" fill="#111">${value}</text></svg>`,
            ),
            left: 6 + i * 156,
            top: 242,
          },
        ]),
      )
      .png()
      .toFile(path.join(dir, `${suit}.png`))
  }
  console.log(`Kontaktbögen in ${dir}`)
}
