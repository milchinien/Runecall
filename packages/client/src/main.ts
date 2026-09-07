/**
 * Runecall -- Einstiegspunkt des Clients.
 *
 * Zwei Bildschirme: das Menue und der Tisch. Hier liegt nur, was zwischen
 * ihnen umschaltet, die Einstellungen verwaltet und eine gewertete Partie am
 * Ende verbucht. Gespielt wird in session.ts (Ablauf) und ui.ts
 * (Darstellung), gewaehlt wird in menu.ts (Bildschirme).
 */

import './style.css'
import { createMenu, type Menu } from './menu.ts'
import type { MatchConfig } from './match.ts'
import { placementOf, recordRankedResult, tierOf } from './rank.ts'
import {
  DEFAULT_SETTINGS,
  clearGame,
  loadGame,
  loadSettings,
  saveSettings,
  type Settings,
} from './settings.ts'
import { HUMAN, createSession, type Session } from './session.ts'
import { bootScene, renderTable, resetTableView } from './ui.ts'

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id)
  if (el === null) throw new Error(`Element #${id} fehlt im Dokument`)
  return el as T
}

let settings: Settings = { ...DEFAULT_SETTINGS, ...loadSettings() }
let session: Session | null = null

/**
 * Was die letzte gewertete Partie am Rang geaendert hat.
 *
 * Steht hier und nicht in rank.ts, weil es kein Wissen ist, sondern eine
 * Nachricht: Sie gilt fuer die Wertungstafel dieser einen Partie und ist
 * danach vorbei.
 */
let rankNote: string | null = null
/** Eine Partie wird genau einmal verbucht, egal wie oft neu gezeichnet wird. */
let counted = false

/* ------------------------------------------------------------------ *
 * Menue und Tisch
 * ------------------------------------------------------------------ */

const menu: Menu = createMenu($('menuScreen'), {
  settings: () => settings,

  change(patch) {
    settings = { ...settings, ...patch }
    saveSettings(settings)

    // Tempo und Hilfen gelten sofort -- wer sie im Menue umstellt, waehrend
    // eine Partie ruht, will sie beim Fortsetzen geaendert vorfinden. Die
    // Sitzung liest sie beim Zeichnen, also genuegt es, neu zu zeichnen.
    if (session !== null) renderTable(session, handlers)
  },

  hasSave: () => loadGame() !== null,
  resume: resumeGame,
  start: startGame,
  quit: closeWindow,
})

function showMenu(screen?: Parameters<Menu['open']>[0]): void {
  session?.stop()
  session = null
  $('menu').hidden = false
  $('table').hidden = true
  menu.open(screen)
}

function showTable(created: Session): void {
  menu.close()
  session = created
  $('menu').hidden = true
  $('table').hidden = false
  renderTable(created, handlers)
}

/* ------------------------------------------------------------------ *
 * Partie
 * ------------------------------------------------------------------ */

function startGame(match: MatchConfig): void {
  session?.stop()
  resetTableView()
  clearGame()

  rankNote = null
  counted = false

  const seed = Math.floor(Math.random() * 0x7fffffff)
  showTable(createSession({ settings, match, seed }, onChange))
}

/**
 * Die angefangene Partie weiterspielen.
 *
 * Die Regeln kommen aus dem Spielstand -- Spielerzahl, Rundenzahl und Modus
 * stehen fest, seit die Partie begonnen hat. Tempo und Hilfen dagegen gelten
 * so, wie sie jetzt eingestellt sind.
 */
function resumeGame(): void {
  const saved = loadGame()
  if (saved === null) {
    showMenu('home')
    return
  }

  session?.stop()
  resetTableView()

  rankNote = null
  counted = false

  showTable(
    createSession({ settings, match: saved.match, seed: saved.seed, resume: saved.state }, onChange),
  )
}

function onChange(): void {
  const current = session
  if (current === null) return

  countRankedResult(current)
  renderTable(current, handlers)
}

/**
 * Verbucht das Ergebnis einer gewerteten Partie -- einmal, am Partieende.
 *
 * Nur der eigene Platz zaehlt. Was die anderen bekommen, entscheidet spaeter
 * der Server; ein Bot hat keinen Rang.
 */
function countRankedResult(current: Session): void {
  if (counted || current.match.mode !== 'ranked') return

  const state = current.state()
  if (state.phase !== 'game-over') return

  counted = true
  const result = recordRankedResult(placementOf(state.scores, HUMAN))
  const stand = `${result.rank.points} RP (${tierOf(result.rank.points)})`

  rankNote =
    result.delta === 0
      ? `${result.place}. Platz — unter null geht es nicht, du bleibst bei ${stand}.`
      : `${result.place}. Platz — ${result.delta > 0 ? '+' : ''}${result.delta} Rangpunkte. Du stehst bei ${stand}.`
}

const handlers = {
  onMenu: () => {
    clearGame()
    showMenu('home')
  },

  // Noch eine Partie derselben Art: im eigenen Raum mit denselben
  // Einstellungen, in der Spielersuche mit demselben festen Regelsatz.
  onNewGame: () => {
    const match = session?.match
    if (match === undefined) return showMenu('home')
    startGame(match)
  },

  rankNote: () => rankNote,
}

/* ------------------------------------------------------------------ *
 * Verdrahtung
 * ------------------------------------------------------------------ */

$('btnMenu').addEventListener('click', () => showMenu('home'))

/**
 * Das Fenster schliessen -- soweit der Browser es zulaesst.
 *
 * Er laesst es nur zu, wenn die Seite sich selbst geoeffnet hat: In der
 * spaeteren Windows-Anwendung geht es, im Tab nicht. Nachfragen laesst sich
 * das nicht verlaesslich, deshalb bleibt es beim Versuch -- das Menue sagt
 * anschliessend, dass man den Tab selbst schliessen kann.
 */
function closeWindow(): void {
  window.close()
}

// Zwei Dinge, die hier frueher standen, macht jetzt die Szene:
//
// - Der Klick ins Leere, der die Wartezeit abkuerzt (Frage 16). Er gehoert
//   dorthin, wo entschieden wird, ob der Zeiger eine Karte getroffen hat --
//   `onEmptyClick` in scene/table.ts.
// - Die Neuberechnung beim Aendern der Fenstergroesse. Die Handkarten liegen
//   nicht mehr im Seitenaufbau, sondern in der Szene; sie folgt der
//   Zeichenflaeche selbst (`ResizeObserver` in scene/stage.ts).

showMenu('home')

// Der Raum steht von Anfang an, auch hinter dem Menue: Er ist die Buehne,
// nicht der Spielbildschirm. Nebenbei ist die Kartentafel dann schon geladen,
// wenn die erste Karte gelegt wird.
bootScene()
