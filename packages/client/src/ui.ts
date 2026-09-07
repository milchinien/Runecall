/**
 * Die Bedienoberflaeche ueber der Szene.
 *
 * Der Tisch selbst liegt in `scene/` -- hier steht, was Text und Knopf ist:
 * Namensschilder, Ansage, Statuszeile, Kartenzaehl-Hilfe und Wertung. Sie
 * bleiben HTML und wandern nicht in die Szene (Entscheidung 4.2). In eine
 * Textur gerendert waere Text unscharf, nicht markierbar, nicht vorlesbar und
 * nicht mit der Tastatur erreichbar.
 *
 * Zwei Dinge verbinden beide Schichten:
 *
 * - **Ankerpunkte.** Was zu einem Platz gehoert, haengt an dessen
 *   Bildschirmposition. Die Szene rechnet sie aus, diese Schicht schiebt das
 *   Schild dorthin -- Bild fuer Bild, damit es mitwandert.
 * - **Die Tastaturhand.** Karten in einer Zeichenflaeche sind fuer Tastatur
 *   und Vorlesehilfen unsichtbar. Es gibt deshalb ueber jeder eigenen Karte
 *   einen unsichtbaren Knopf, der genau das kann, was die Karte kann.
 *
 * Umgesetzte Entscheidungen wie bisher: gesperrte Karten bleiben sichtbar und
 * erklaeren sich beim Antippen (12), die Hand ist sortiert (13), angesagt wird
 * ueber eine Reihe Zahlen (14), Kartenzaehl-Hilfe zuschaltbar (15), kurze
 * Pause mit hervorgehobener Gewinnkarte (19).
 */

import { Vector2, Vector3 } from 'three'
import {
  SUITS,
  ledSuitOf,
  playViolation,
  roundScore,
  sortForDisplay,
  winnersOf,
  type CardId,
  type PlayerView,
} from '@runecall/engine'
import { estimateTricks } from '@runecall/bots'

import { cardLabel } from './cardview.ts'
import { SUIT_STYLES, createRune } from './runes.ts'
import { loadCardAtlas } from './scene/atlas.ts'
import { clamp } from './scene/motion.ts'
import { createRoom } from './scene/room.ts'
import { createStage, type Stage } from './scene/stage.ts'
import { createCardStorm } from './scene/storm.ts'
import { createTableScene, type TableScene } from './scene/table.ts'
import { HUMAN, type Session } from './session.ts'

const NAMES = ['Du', 'Ben', 'Chris', 'Dana', 'Emil', 'Fee'] as const
const nameOf = (seat: number): string => NAMES[seat] ?? `Platz ${seat}`

const REASON_LABEL = {
  mage: 'erster Magier',
  trump: 'höchster Trumpf',
  'led-suit': 'höchste angespielte Farbe',
  'jesters-only': 'nur Narren — der erste gewinnt',
} as const

/** Auf Geraeten ohne Mauszeiger hebt der erste Tipp die Karte nur an (Frage 2.10). */
const twoStep = !window.matchMedia('(hover: hover)').matches

/**
 * Weltpunkte, an denen die Bedienung im Raum haengt.
 *
 * Die Ansageleiste steht als Bogen vor dem eigenen Platz, die Statuszeile
 * darueber (Stufe 6). Beide sind an den Raum geheftet statt an den
 * Fensterrand -- so ruecken sie mit, wenn sich das Fenster aendert, und
 * bleiben immer da, wo man ohnehin hinsieht.
 */
const ACTION_ANCHOR = new Vector3(0, 1.3, 1.62)
const STATUS_ANCHOR = new Vector3(0, 2.0, 0.75)

/**
 * Wo das Trumpfschild haengt: unter der Trumpfkarte auf dem Tisch.
 *
 * Die Punkte sind dieselben wie `TRUMP_AT` in scene/table.ts, ein Stueck zum
 * Betrachter hin verschoben -- dorthin, wo im Bild "unter der Karte" liegt.
 * Zwei Stellen, ein Mass: Wer die Karte verschiebt, muss das Schild
 * mitnehmen. Es steht hier trotzdem, weil die Szene keine Schilder kennt
 * (Entscheidung 4.2).
 */
const TRUMP_ANCHOR = new Vector3(2.15, 0.05, 0.72)

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id)
  if (el === null) throw new Error(`Element #${id} fehlt im Dokument`)
  return el as T
}

/* ------------------------------------------------------------------ *
 * Zustand der Darstellung
 * ------------------------------------------------------------------ */

export type TableHandlers = {
  readonly onMenu: () => void
  readonly onNewGame: () => void
  /**
   * Was die Partie am Rang geaendert hat, oder `null`, wenn sie nicht
   * gewertet war. Wird erst am Partieende gebraucht -- deshalb eine
   * Funktion und kein Wert: Beim Zeichnen der ersten Runde gibt es sie noch
   * gar nicht.
   */
  readonly rankNote: () => string | null
}

let stage: Stage | null = null
let table: TableScene | null = null
let booting = false

let session: Session | null = null
let tableHandlers: TableHandlers = { onMenu: () => {}, onNewGame: () => {}, rankNote: () => null }

/** Namensschilder und Tastaturknoepfe, wiederverwendet statt neu gebaut. */
const plates = new Map<number, HTMLElement>()
const handKeys = new Map<CardId, HTMLButtonElement>()

let selected: CardId | null = null
let hovered: CardId | null = null
let toastTimer: number | null = null

export function resetTableView(): void {
  table?.reset()
  selected = null
  hovered = null

  for (const el of plates.values()) el.remove()
  plates.clear()
  for (const el of handKeys.values()) el.parentElement?.remove()
  handKeys.clear()
}

/* ------------------------------------------------------------------ *
 * Die Szene aufbauen
 * ------------------------------------------------------------------ */

/**
 * Baut den Raum, und darin nach und nach den Tisch.
 *
 * In drei Schritten, weil sie verschieden lange dauern:
 *
 * 1. Zeichenflaeche, Kamera und Bildschleife -- sofort.
 * 2. Der Raum: Buehne, Tisch, Licht, Partikel (Stufe 1). Er kennt keine
 *    Karten und braucht deshalb auf nichts zu warten. Er steht hinter allem,
 *    auch hinter dem Menue -- er ist die Buehne, nicht der Spielbildschirm.
 * 3. Die Karten, sobald die Bildtafel geladen ist. Das dauert einen Moment;
 *    die Bedienoberflaeche wartet nicht darauf, Ansagen und Menue
 *    funktionieren schon, waehrend der Tisch noch entsteht.
 *
 * Darf mehrfach gerufen werden -- der zweite Ruf tut nichts.
 */
export function bootScene(): void {
  if (stage !== null || booting) return
  booting = true

  const canvas = $<HTMLCanvasElement>('scene')
  const created = createStage(canvas)
  stage = created
  // Nur fuer Werkzeuge im Dev-Betrieb: erlaubt einen Render von aussen,
  // wenn der Tab unsichtbar ist und requestAnimationFrame stillsteht.
  if (import.meta.env.DEV) Object.assign(window, { __stage: created })

  const built = createRoom(created.reducedMotion, created.renderer.capabilities.getMaxAnisotropy())
  created.scene.add(built.group)
  created.onFrame((dt) => {
    // Die Buehne liegt als ebene Flaeche vor der Kamera und muss dem
    // Bildwinkel folgen -- der aendert sich mit der Fenstergroesse.
    built.fit(created.camera)
    built.update(dt)
  })

  created.onFrame(anchorOverlay)

  void loadCardAtlas(created.renderer.capabilities.getMaxAnisotropy())
    .then((atlas) => {
      // Der Kartensturm gehoert zur Kulisse, braucht aber die Bildtafel --
      // deshalb steht er hier und nicht beim Raum.
      const storm = createCardStorm(created, atlas)
      created.scene.add(storm.mesh)
      if (!created.reducedMotion) created.onFrame((dt) => storm.update(dt))

      table = createTableScene(created, atlas, {
        onPick: (cardId) => pickCard(cardId),
        onHover: (cardId) => {
          hovered = cardId
          table?.focus(cardId)
        },
        onEmptyClick: () => session?.skip(),
      })
      if (session !== null) renderTable(session, tableHandlers)
    })
    .catch((error: unknown) => {
      console.error('Runecall: Die Kartentafel liess sich nicht laden.', error)
      showToast('Die Kartenbilder fehlen — bitte neu laden.')
    })
    .finally(() => {
      booting = false
    })
}

/* ------------------------------------------------------------------ *
 * Hinweise
 * ------------------------------------------------------------------ */

export function showToast(text: string): void {
  const el = $('toast')
  el.textContent = text
  el.hidden = false
  el.classList.add('is-visible')

  if (toastTimer !== null) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    el.classList.remove('is-visible')
    toastTimer = window.setTimeout(() => {
      el.hidden = true
    }, 220)
  }, 1900)
}

/* ------------------------------------------------------------------ *
 * Gesamtbild
 * ------------------------------------------------------------------ */

export function renderTable(current: Session, handlers: TableHandlers): void {
  session = current
  tableHandlers = handlers
  bootScene()

  const state = current.state()
  const view = current.view()
  const frozen = current.waiting() === 'trick'

  $('roundInfo').textContent = `Runde ${state.roundNumber} von ${state.totalRounds}`

  // Die gemessenen Schildmasse gelten nur bis zur naechsten Aenderung des
  // Textes -- und die passiert genau hier.
  sizes.clear()

  table?.show(view, frozen)
  renderPlates(view, current)
  renderTrump(view)
  renderStatus(view, current)
  renderActions(view, current)
  renderHandKeys(view, current)
  renderCounting(view, current)
  renderSheet(view, current, handlers)

  anchorOverlay()
}

/* ------------------------------------------------------------------ *
 * Namensschilder
 * ------------------------------------------------------------------ */

/**
 * Ein Schild je Platz: Name, Ansage gegen Stiche, Punktestand.
 *
 * Die Schilder werden wiederverwendet statt neu gebaut. Sonst faellt bei
 * jedem Neuzeichnen der Uebergang aus, mit dem der Platz aufleuchtet, der am
 * Zug ist -- und das Aufleuchten ist der halbe Zweck der Schilder.
 */
function renderPlates(view: PlayerView, current: Session): void {
  const box = $('plates')

  for (const [seat, el] of plates) {
    if (seat < view.handSizes.length) continue
    el.remove()
    plates.delete(seat)
  }

  for (let seat = 0; seat < view.handSizes.length; seat++) {
    let el = plates.get(seat)
    // Ein frisch gebautes Schild hat noch nichts, was sich aendern koennte --
    // sein erster Text ist kein Ereignis und bekommt deshalb keinen Anstoss.
    const fresh = el === undefined

    if (el === undefined) {
      el = document.createElement('div')
      el.className = 'plate'
      el.dataset['seat'] = String(seat)
      el.innerHTML =
        '<span class="plate__avatar" aria-hidden="true"></span><span class="plate__name"></span><span class="plate__tally"></span><span class="plate__score"></span>'
      plates.set(seat, el)
      box.append(el)
    }

    const bid = view.bids[seat]
    const tally = bid === null || bid === undefined ? '–' : `${view.tricksWon[seat] ?? 0}/${bid}`

    setText(el, '.plate__name', nameOf(seat))
    setText(el, '.plate__avatar', seat === HUMAN ? '◆' : nameOf(seat).slice(0, 1))
    setText(el, '.plate__score', `${view.scores[seat] ?? 0}`)

    // Ein Stich mehr ist das einzige, was sich am Schild waehrend des Spiels
    // aendert -- und es aendert sich um eine Ziffer. Ohne einen Anstoss
    // uebersieht man ihn: Der Zaehler zuckt kurz auf, wenn er weiterspringt.
    if (setText(el, '.plate__tally', tally) && !fresh) bump(el)

    // Am Rundenende steht am Platz, ob die Ansage gestimmt hat -- dieselbe
    // Auskunft wie in der Wertungstafel, nur dort, wo man ohnehin hinsieht.
    const scored = view.phase === 'round-end' || view.phase === 'game-over'
    const hit = scored && bid !== null && bid !== undefined && (view.tricksWon[seat] ?? 0) === bid

    el.classList.toggle('is-me', seat === HUMAN)
    el.classList.toggle('is-dealer', seat === view.dealer)
    el.classList.toggle('is-turn', isOnTurn(view, seat) && current.waiting() !== 'trick')
    el.classList.toggle('is-winner', current.waiting() === 'trick' && view.lastTrick?.winner === seat)
    el.classList.toggle('is-hit', hit)
    el.classList.toggle('is-missed', scored && !hit)
    el.title = seat === view.dealer ? 'Geber' : ''
  }
}

/* ------------------------------------------------------------------ *
 * Trumpfschild
 * ------------------------------------------------------------------ */

/**
 * Was die Karte neben dem Stapel bedeutet.
 *
 * Sie liegt dort die ganze Runde lang, und ohne Beschriftung muss man sich
 * merken, warum. Das Schild traegt die Farbe des Trumpfs samt ihrer Rune --
 * und sagt auch, wenn es keinen gibt: Ein Narr als aufgedeckte Karte heisst
 * "diese Runde ohne Trumpf", und das ist eine Auskunft, keine Leerstelle.
 */
function renderTrump(view: PlayerView): void {
  const el = $('trump')

  if (view.trumpCard === null) {
    el.hidden = true
    return
  }

  const suit = view.trumpSuit
  const wanted = suit ?? 'none'
  el.hidden = false

  // Nur neu bauen, wenn sich die Farbe geaendert hat: Das Schild haengt an
  // der Szene und wird jedes Bild verschoben -- ein Neuaufbau je Zug waere
  // Arbeit fuer nichts.
  if (el.dataset['suit'] === wanted) return
  el.dataset['suit'] = wanted

  el.className = `trump trump--${wanted}`
  el.replaceChildren()

  if (suit !== null) el.append(createRune(suit))

  const text = document.createElement('span')
  text.textContent = suit === null ? 'ohne Trumpf' : `Trumpf ${SUIT_STYLES[suit].label}`
  el.append(text)
}

/** Setzt Text und meldet, ob sich dabei etwas geaendert hat. */
function setText(root: HTMLElement, selector: string, text: string): boolean {
  const el = root.querySelector(selector)
  if (el === null || el.textContent === text) return false
  el.textContent = text
  return true
}

/**
 * Ein kurzer Anstoss.
 *
 * Wie bei der Statuszeile faengt eine laufende Animation nicht dadurch von
 * vorn an, dass ihre Klasse noch einmal gesetzt wird -- sie muss weg, das
 * Bild neu berechnet und die Klasse wieder da sein.
 */
function bump(el: HTMLElement): void {
  el.classList.remove('is-bumped')
  void el.offsetWidth
  el.classList.add('is-bumped')
}

function isOnTurn(view: PlayerView, seat: number): boolean {
  if (view.phase === 'trump-choice') return seat === view.dealer
  if (view.phase === 'bidding' || view.phase === 'playing') return seat === view.turn
  return false
}

/* ------------------------------------------------------------------ *
 * Statuszeile
 * ------------------------------------------------------------------ */

/**
 * Die Statuszeile.
 *
 * Sie steht mitten im Bild und aendert sich bei jedem Zug -- deshalb wird der
 * Text erst gebaut und dann einmal gesetzt: Nur der wirkliche Wechsel stoesst
 * das Aufblenden an. Setzte jedes Neuzeichnen denselben Satz neu, blitzte die
 * Zeile bei jedem Bild.
 */
function renderStatus(view: PlayerView, current: Session): void {
  const el = $('status')
  const text = statusText(view, current)
  if (el.textContent === text) return

  el.textContent = text

  // Eine laufende Animation faengt nicht dadurch von vorn an, dass ihre
  // Klasse noch einmal gesetzt wird. Sie muss weg, das Bild neu berechnet
  // (`offsetWidth`) und dann wieder da sein.
  el.classList.remove('is-fresh')
  void el.offsetWidth
  el.classList.add('is-fresh')
}

function statusText(view: PlayerView, current: Session): string {
  if (current.waiting() === 'trick' && view.lastTrick !== null) {
    const { winner, reason } = view.lastTrick
    return `${nameOf(winner)} gewinnt den Stich — ${REASON_LABEL[reason]}`
  }

  switch (view.phase) {
    case 'trump-choice':
      return view.dealer === HUMAN
        ? 'Ein Magier liegt offen — wähle die Trumpffarbe.'
        : `${nameOf(view.dealer)} wählt die Trumpffarbe …`

    case 'bidding':
      return view.turn === HUMAN
        ? 'Wie viele Stiche gewinnst du?'
        : `${nameOf(view.turn)} sagt an …`

    case 'playing': {
      const led = ledSuitOf(view.currentTrick)
      const farbe =
        led.suit !== null
          ? `${SUIT_STYLES[led.suit].label} angespielt`
          : led.settled
            ? 'keine Farbe angespielt — alle frei'
            : view.currentTrick.length > 0
              ? 'Farbe noch offen'
              : 'neuer Stich'
      const wer = view.turn === HUMAN ? 'du bist am Zug' : `${nameOf(view.turn)} ist am Zug`
      return `Stich ${view.trickNumber} von ${view.roundNumber} · ${farbe} · ${wer}`
    }

    default:
      return ''
  }
}

/* ------------------------------------------------------------------ *
 * Ansage und Trumpfwahl
 * ------------------------------------------------------------------ */

function renderActions(view: PlayerView, current: Session): void {
  const box = $('actions')
  box.replaceChildren()

  if (view.phase === 'trump-choice' && view.dealer === HUMAN) {
    for (const suit of SUITS) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = `pill pill--${suit}`
      // Rune und Wort, nicht nur das Wort: Hier waehlt man eine Farbe, und
      // wer Rot und Gruen nicht unterscheidet, waehlt sonst blind
      // (Entscheidung 24). Es ist dieselbe Rune wie auf der Karte.
      button.append(createRune(suit), document.createTextNode(SUIT_STYLES[suit].label))
      button.title = `${SUIT_STYLES[suit].label} — Rune ${SUIT_STYLES[suit].runeName}`
      button.addEventListener('click', () => current.chooseTrump(suit))
      box.append(button)
    }
    arrangeArc(box)
    return
  }

  if (view.phase !== 'bidding' || view.turn !== HUMAN) return

  const estimate = estimateTricks(view)
  const suggestion = current.settings.hint
    ? Math.max(0, Math.min(view.roundNumber, Math.round(estimate)))
    : null

  for (let value = 0; value <= view.roundNumber; value++) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'pill'
    button.textContent = String(value)
    if (value === suggestion) {
      button.classList.add('is-suggested')
      button.title = 'Vorschlag der Ansage-Hilfe'
    }
    button.addEventListener('click', () => current.bid(value))
    box.append(button)
  }

  arrangeArc(box)

  if (suggestion !== null) {
    const hint = document.createElement('span')
    hint.className = 'actions__hint'
    hint.textContent = `Deine Hand ist etwa ${estimate.toFixed(1)} Stiche wert`
    box.append(hint)
  }
}

/**
 * Legt die Knoepfe auf einen Bogen -- Stufe 6.
 *
 * Derselbe Bogen wie der Kartenfaecher darueber: in der Mitte am hoechsten,
 * zu den Seiten abfallend und mitgedreht. Der Radius ist gross genug, dass
 * es eine Woelbung bleibt und keine Schuessel wird.
 */
function arrangeArc(box: HTMLElement): void {
  const items = Array.from(box.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  )
  const count = items.length
  if (count === 0) return

  const radius = 640
  const total = Math.min(0.66, 0.085 * count)

  items.forEach((el, index) => {
    const share = count > 1 ? index / (count - 1) - 0.5 : 0
    const angle = share * total
    const x = Math.sin(angle) * radius
    const y = (1 - Math.cos(angle)) * radius

    el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${((angle * 180) / Math.PI).toFixed(2)}deg)`
    // Der Bogen laeuft auf, statt dazustehen: jeder Knopf eine Spur nach dem
    // vorigen. Die Bewegung selbst steht im Stylesheet (`deal-in`) -- hier
    // steht nur, wer wann an der Reihe ist.
    el.style.animationDelay = `${(index * 0.035).toFixed(3)}s`
  })
}

/* ------------------------------------------------------------------ *
 * Die Tastaturhand
 * ------------------------------------------------------------------ */

/**
 * Die unsichtbare Entsprechung der eigenen Hand.
 *
 * Je eigener Karte ein Knopf, genau ueber ihr. Er traegt ihren Namen, ihre
 * Sperre und ihre Reihenfolge -- alles, was eine Vorlesehilfe braucht und was
 * eine Zeichenflaeche nicht hergibt.
 *
 * Zeigergeraete gehen absichtlich an diesen Knoepfen vorbei
 * (`pointer-events: none`): Fuer die Maus ist die Karte in der Szene
 * zustaendig, sonst gaebe es zwei Stellen, die auf denselben Klick warten --
 * und das Ziehen zur Tischmitte funktionierte nicht mehr. Tastatur und
 * Vorlesehilfen erreichen den Knopf davon unberuehrt.
 */
function renderHandKeys(view: PlayerView, current: Session): void {
  const box = $('handKeys')
  const hand = sortForDisplay(view.hand, view.trumpSuit)
  const wanted = new Set(hand.map((card) => card.id))

  for (const [id, el] of handKeys) {
    if (wanted.has(id)) continue
    el.parentElement?.remove()
    handKeys.delete(id)
  }
  if (selected !== null && !wanted.has(selected)) selected = null

  const myTurn = view.phase === 'playing' && view.turn === HUMAN && current.waiting() === 'none'

  hand.forEach((card, index) => {
    let button = handKeys.get(card.id)

    if (button === undefined) {
      const item = document.createElement('li')
      button = document.createElement('button')
      button.type = 'button'
      button.className = 'handkey'
      // Der Zuhaenger fragt den Zustand erst beim Klick ab. Wuerde er die
      // Sicht von jetzt festhalten, entschiede beim Klick eine veraltete
      // Lage darueber, ob der Zug erlaubt ist.
      button.addEventListener('click', () => pickCard(card.id))
      button.addEventListener('focus', () => table?.focus(card.id))
      button.addEventListener('blur', () => table?.focus(hovered))
      button.addEventListener('keydown', onHandKey)
      item.append(button)
      handKeys.set(card.id, button)
      box.append(item)
    }

    const playable = myTurn && view.playable.includes(card.id)
    const position = `Karte ${index + 1} von ${hand.length}`
    const state = !myTurn ? '' : playable ? ', spielbar' : ', gesperrt'

    button.setAttribute('aria-label', `${cardLabel(card)} — ${position}${state}`)
    button.setAttribute('aria-disabled', String(myTurn && !playable))
    button.dataset['card'] = card.id
    button.tabIndex = myTurn ? 0 : -1
  })
}

/** Links und rechts durch den Faecher, wie es eine Werkzeugleiste vormacht. */
function onHandKey(event: KeyboardEvent): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

  const buttons = Array.from(handKeys.values()).filter((button) => button.tabIndex === 0)
  const here = buttons.indexOf(event.currentTarget as HTMLButtonElement)
  if (here < 0 || buttons.length === 0) return

  event.preventDefault()
  const step = event.key === 'ArrowLeft' ? -1 : 1
  buttons[(here + step + buttons.length) % buttons.length]?.focus()
}

/**
 * Eine eigene Karte wurde gewaehlt -- per Klick, per Wurf oder per Tastatur.
 *
 * Die Regel steht in der Engine; hier wird nur nachgesehen, warum eine Karte
 * gesperrt ist, damit die Sperre sich erklaeren kann (Frage 12).
 */
function pickCard(cardId: CardId): void {
  const current = session
  if (current === null) return

  const view = current.view()
  const card = view.hand.find((entry) => entry.id === cardId)
  if (card === undefined) return

  if (view.phase !== 'playing' || view.turn !== HUMAN || current.waiting() !== 'none') {
    renderTable(current, tableHandlers)
    return
  }

  const violation = playViolation(card, view.hand, view.currentTrick)
  if (violation !== null) {
    showToast(`Du musst ${SUIT_STYLES[violation.suit].label} bedienen`)
    renderTable(current, tableHandlers)
    return
  }

  // Auf dem Telefon hebt der erste Tipp die Karte nur an, erst der zweite
  // spielt sie -- das schuetzt vor Fehlgriffen im engen Faecher (Frage 2.10).
  if (twoStep && selected !== cardId) {
    selected = cardId
    table?.select(cardId)
    return
  }

  selected = null
  table?.select(null)
  current.play(cardId)
}

/* ------------------------------------------------------------------ *
 * Kartenzaehl-Hilfe
 * ------------------------------------------------------------------ */

function renderCounting(view: PlayerView, current: Session): void {
  const box = $('counting')

  if (!current.settings.counting) {
    box.hidden = true
    return
  }

  box.hidden = false
  box.replaceChildren()

  const title = document.createElement('span')
  title.className = 'counting__title'
  title.textContent = 'In dieser Runde gefallen'
  box.append(title)

  if (view.playedCards.length === 0) {
    const none = document.createElement('span')
    none.className = 'counting__none'
    none.textContent = 'noch nichts'
    box.append(none)
    return
  }

  const row = document.createElement('div')
  row.className = 'counting__row'
  for (const card of sortForDisplay(view.playedCards, view.trumpSuit)) {
    const chip = document.createElement('span')
    chip.className = 'chip'
    if (card.kind === 'pip') chip.classList.add(`chip--${card.suit}`)
    chip.textContent = card.kind === 'pip' ? String(card.value) : card.kind === 'mage' ? '★' : '?'
    chip.title = cardLabel(card)
    row.append(chip)
  }
  box.append(row)
}

/* ------------------------------------------------------------------ *
 * Rundenende und Partieende
 * ------------------------------------------------------------------ */

/**
 * Die Wertung als Tafel im Raum, nicht als Vorhang darueber (Stufe 6).
 *
 * Der Unterschied ist nicht nur Zierde: Ein Vorhang macht den Tisch blass und
 * nimmt einem den Blick auf das, was gerade gewertet wird. Die Tafel steht
 * davor und laesst den Raum stehen.
 */
function renderSheet(view: PlayerView, current: Session, handlers: TableHandlers): void {
  const box = $('overlay')

  if (view.phase !== 'round-end' && view.phase !== 'game-over') {
    box.hidden = true
    box.replaceChildren()
    return
  }

  box.hidden = false
  box.replaceChildren()

  const panel = document.createElement('div')
  panel.className = 'sheet'

  const heading = document.createElement('h2')
  heading.textContent =
    view.phase === 'game-over' ? 'Partie zu Ende' : `Runde ${view.roundNumber} gewertet`
  panel.append(heading)

  /*
   * Eine Zeile, die sagt, wie es ausging.
   *
   * Am Rundenende die eigene Ausbeute, am Partieende, wer gewonnen hat. Ohne
   * sie beginnt die Tafel mit einer Tabelle, und man muss sich die eigene
   * Zeile erst suchen, um zu erfahren, wie es gelaufen ist.
   */
  const note = document.createElement('p')
  note.className = 'sheet__note'
  note.textContent = sheetNote(view)
  panel.append(note)

  /*
   * Die Zeile darunter gehoert der gewerteten Partie.
   *
   * Sie steht oben bei der Wertung und nicht im Menue, weil der Platz genau
   * hier entschieden wurde -- wer erst ins Menue zurueck muss, um zu sehen,
   * was die Partie gebracht hat, sieht es sich nicht an.
   */
  const rank = view.phase === 'game-over' ? handlers.rankNote() : null
  if (rank !== null) {
    const line = document.createElement('p')
    line.className = 'sheet__rank'
    line.textContent = rank
    panel.append(line)
  }

  const scores = document.createElement('table')
  scores.className = 'sheet__table'
  scores.innerHTML =
    '<thead><tr><th>Spieler</th><th>Ansage</th><th>Stiche</th><th>Runde</th><th>Gesamt</th></tr></thead>'

  const body = document.createElement('tbody')
  const order = view.scores.map((score, seat) => ({ seat, score })).sort((a, b) => b.score - a.score)

  for (const { seat, score } of order) {
    const bid = view.bids[seat] ?? 0
    const won = view.tricksWon[seat] ?? 0
    const gained = roundScore(bid, won)
    const row = document.createElement('tr')
    if (seat === HUMAN) row.className = 'is-me'
    if (bid === won) row.classList.add('is-hit')

    for (const text of [nameOf(seat), String(bid), String(won)]) {
      const cell = document.createElement('td')
      cell.textContent = text
      row.append(cell)
    }

    // Was diese Runde eingebracht hat, steht neben dem Gesamtstand: Der
    // Gesamtstand allein verraet nicht, ob es gerade gut lief.
    const delta = document.createElement('td')
    delta.className = gained >= 0 ? 'is-gain' : 'is-loss'
    delta.textContent = gained > 0 ? `+${gained}` : String(gained)
    row.append(delta)

    const total = document.createElement('td')
    total.textContent = String(score)
    row.append(total)

    body.append(row)
  }
  scores.append(body)
  panel.append(scores)

  const actions = document.createElement('div')
  actions.className = 'sheet__actions'

  if (view.phase === 'round-end') {
    const next = document.createElement('button')
    next.type = 'button'
    next.textContent = 'Nächste Runde'
    next.addEventListener('click', () => current.nextRound())
    actions.append(next)
  } else {
    const again = document.createElement('button')
    again.type = 'button'
    again.textContent = 'Neue Partie'
    again.addEventListener('click', handlers.onNewGame)

    const menu = document.createElement('button')
    menu.type = 'button'
    menu.className = 'ghost'
    menu.textContent = 'Menü'
    menu.addEventListener('click', handlers.onMenu)

    actions.append(again, menu)
  }

  panel.append(actions)
  box.append(panel)
}

/**
 * Der Satz ueber der Tabelle.
 *
 * Am Partieende, wer gewonnen hat -- bei Gleichstand alle, die vorn liegen
 * (Frage 11). Am Rundenende die eigene Ausbeute, und zwar in Worten: "zwei
 * Stiche zu viel" sagt mehr als "3 gegen 1".
 */
function sheetNote(view: PlayerView): string {
  if (view.phase === 'game-over') {
    const winners = winnersOf(view.scores)
    const best = view.scores[winners[0] ?? 0] ?? 0

    if (winners.length > 1) {
      const names = winners.map(nameOf)
      return `Geteilter Sieg für ${names.slice(0, -1).join(', ')} und ${names.at(-1)} — ${best} Punkte.`
    }
    const winner = winners[0] ?? 0
    return winner === HUMAN
      ? `Du gewinnst mit ${best} Punkten.`
      : `${nameOf(winner)} gewinnt mit ${best} Punkten.`
  }

  const bid = view.bids[HUMAN] ?? 0
  const won = view.tricksWon[HUMAN] ?? 0
  const gained = roundScore(bid, won)
  if (bid === won) return `Ansage getroffen — ${gained} Punkte dazu.`

  const off = Math.abs(won - bid)
  const stiche = off === 1 ? 'Ein Stich' : `${off} Stiche`
  const richtung = won > bid ? 'zu viel' : 'zu wenig'
  // Das Vorzeichen steht im Wort, nicht an der Zahl: "— -10 Punkte" liest
  // sich wie ein Tippfehler.
  return `${stiche} ${richtung} — ${Math.abs(gained)} Punkte ab.`
}

/* ------------------------------------------------------------------ *
 * Ankerpunkte
 * ------------------------------------------------------------------ */

const anchor = new Vector2()

/**
 * Heftet die HTML-Schicht an die Szene.
 *
 * Laeuft in jedem Bild, weil Karten sich bewegen und die Schilder mitgehen
 * muessen. Verschoben wird ausschliesslich ueber `transform` -- damit bleibt
 * es Sache des Compositors und loest kein Neuberechnen des Seitenaufbaus aus.
 */
function anchorOverlay(): void {
  const scene = table
  const current = stage
  if (current === null) return

  place($('actions'), current.toScreen(ACTION_ANCHOR, anchor))
  placeInside($('status'), current.toScreen(STATUS_ANCHOR, anchor))

  const trump = $('trump')
  if (!trump.hidden) placeInside(trump, current.toScreen(TRUMP_ANCHOR, anchor))

  if (scene === null) return

  for (const [seat, el] of plates) {
    const at = scene.seatAt(seat, anchor)
    el.style.visibility = at === null ? 'hidden' : ''
    if (at !== null) placeInside(el, at)
  }

  const size = scene.cardSize()
  const width = `${size.width.toFixed(0)}px`
  const height = `${size.height.toFixed(0)}px`

  for (const [id, button] of handKeys) {
    const at = scene.cardAt(id, anchor)
    button.style.visibility = at === null ? 'hidden' : ''
    if (at !== null) place(button, at)

    // Jeder Knopf ist so gross wie seine Karte. Verglichen wird gegen das,
    // was schon an ihm steht -- damit bekommt ein frisch ausgeteilter Knopf
    // sein Mass genauso wie alle anderen beim Aendern der Fenstergroesse,
    // ohne dass hier Buch darueber gefuehrt werden muss, wer schon vermessen
    // ist. Eine Zuweisung, die nichts aendert, spart der Vergleich.
    if (button.style.width !== width) {
      button.style.width = width
      button.style.height = height
    }
  }
}

function place(el: HTMLElement, at: Vector2): void {
  el.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px) translate(-50%, -50%)`
}

/** Wie nah ein Schild dem Fensterrand kommen darf. */
const EDGE = 10

/**
 * Wie `place()`, aber das Schild bleibt im Bild.
 *
 * Die Sitze links und rechts liegen knapp hinter der Tischkante, und die
 * Tischkante liegt bei einem schmalen Fenster fast am Bildrand: Ihre Schilder
 * ragten dann zur Haelfte hinaus -- bei vier Spielern auf 1280 Punkten stand
 * das linke bei -26, das rechte 22 Punkte zu weit rechts. Das Schild rutscht
 * deshalb so weit herein, dass es ganz zu sehen ist. Es haengt weiter am
 * Platz und wandert mit ihm; es kann ihn nur nicht mehr verlassen.
 *
 * Ist das Fenster schmaler als das Schild selbst, gibt es nichts mehr zu
 * retten -- dann steht es mittig.
 */
function placeInside(el: HTMLElement, at: Vector2): void {
  const size = sizeOf(el)
  anchor.set(
    within(at.x, size.width / 2, window.innerWidth),
    within(at.y, size.height / 2, window.innerHeight),
  )
  place(el, anchor)
}

function within(value: number, half: number, span: number): number {
  const low = half + EDGE
  const high = span - half - EDGE
  return low > high ? span / 2 : clamp(value, low, high)
}

/**
 * Die Masse der Schilder, gemessen statt jedes Bild neu erfragt.
 *
 * `offsetWidth` erzwingt eine Neuberechnung des Seitenaufbaus. Einmal je
 * Neuzeichnen ist das nichts, sechzigmal je Sekunde und Schild waere es
 * etwas. Die Masse aendern sich ohnehin nur, wenn sich der Text aendert oder
 * das Fenster -- beides raeumt den Vorrat.
 */
const sizes = new Map<HTMLElement, { readonly width: number; readonly height: number }>()

function sizeOf(el: HTMLElement): { readonly width: number; readonly height: number } {
  const known = sizes.get(el)
  if (known !== undefined) return known

  const measured = { width: el.offsetWidth, height: el.offsetHeight }
  sizes.set(el, measured)
  return measured
}

window.addEventListener('resize', () => sizes.clear())
