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
import { joinRoom, type Room } from './online.ts'
import type { RefusalCode } from '@runecall/protocol'
import { placementOf, recordRankedResult, tierOf } from './rank.ts'
import {
  DEFAULT_SETTINGS,
  clearGame,
  loadGame,
  loadSettings,
  saveSettings,
  type Settings,
} from './settings.ts'
import { createSession, type Session } from './session.ts'
import { bootScene, renderTable, resetTableView, showToast } from './ui.ts'

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id)
  if (el === null) throw new Error(`Element #${id} fehlt im Dokument`)
  return el as T
}

let settings: Settings = { ...DEFAULT_SETTINGS, ...loadSettings() }
let session: Session | null = null

/**
 * Die offene Verbindung in einen Raum.
 *
 * Sie liegt hier und nicht im Menue, weil sie den Bildschirmwechsel
 * ueberleben muss: Zwischen "Raum eroeffnet" und "Partie laeuft" wechselt die
 * Anzeige vom Menue an den Tisch, die Verbindung aber bleibt dieselbe.
 */
let room: Room | null = null
/** Warum der Raum nicht zustande kam -- steht im Wartebildschirm. */
let roomNote: string | null = null

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
  openRoom,
  leaveRoom,
  room: () => room,
  roomNote: () => roomNote,
  quit: closeWindow,
})

function showMenu(screen?: Parameters<Menu['open']>[0]): void {
  session?.stop()
  session = null
  // Wer ins Menue zurueckgeht, sitzt nicht mehr am Tisch. Eine Verbindung,
  // die dann noch offen stuende, liesse den eigenen Platz im Raum belegt --
  // fuer die anderen sichtbar, aber ohne jemanden dahinter.
  if (screen !== 'room') leaveRoom()
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

/* ------------------------------------------------------------------ *
 * Online
 * ------------------------------------------------------------------ */

/**
 * Einen Raum oeffnen oder betreten.
 *
 * Beide Wege landen im selben Wartebildschirm. Was sie unterscheidet, ist
 * `create`: Wer erstellt, legt den Raum an, falls es ihn nicht gibt; wer
 * beitritt, bekommt eine Absage, statt versehentlich einen zweiten Raum mit
 * vertipptem Code zu eroeffnen.
 */
function openRoom(options: { readonly create: boolean; readonly code: string }): void {
  leaveRoom()
  session?.stop()
  session = null
  roomNote = null

  rankNote = null
  counted = false

  room = joinRoom(
    {
      code: options.code,
      name: settings.playerName.trim(),
      create: options.create,
      settings,
      rules: {
        playerCount: settings.playerCount,
        rounds: settings.rounds,
        difficulty: settings.difficulty,
      },
      onChange,
    },
    {
      onLobby: () => menu.refresh(),

      onStart(created) {
        resetTableView()
        showTable(created)
      },

      onRefused(reason) {
        roomNote = refusalText(reason, options.code)
        room = null
        menu.refresh()
      },

      onClosed(reason) {
        roomNote = reason
        room = null
        // Die Partie lief vielleicht schon. Dann steht der Tisch noch, und
        // die Nachricht gehoert dorthin, wo der Spieler gerade hinsieht.
        if (session === null) menu.refresh()
        else showToast(reason)
      },

      onRejected: (message) => showToast(message),
    },
  )

  menu.open('room')
}

function leaveRoom(): void {
  room?.leave()
  room = null
}

/** Die Absage des Servers in einen Satz uebersetzen, der weiterhilft. */
function refusalText(reason: RefusalCode, code: string): string {
  switch (reason) {
    case 'no-such-room':
      return `Kein Raum mit dem Code ${code}. Vertippt — oder hat dein Freund den Raum noch gar nicht eröffnet?`
    case 'room-full':
      return `Der Raum ${code} ist voll. Der Wirt kann die Spielerzahl erhöhen, dann geht noch jemand hinein.`
    case 'already-started':
      return `Im Raum ${code} läuft die Partie schon. Wer nicht von Anfang an dabei war, kommt nicht mehr dazu.`
    case 'bad-code':
      return 'Diesen Raumcode gibt es so nicht.'
    case 'bad-name':
      return 'Ohne Namen geht es nicht — trag einen ein und versuch es noch einmal.'
  }
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

  const view = current.view()
  if (view.phase !== 'game-over') return

  counted = true
  const result = recordRankedResult(placementOf(view.scores, view.you))
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
  //
  // Online geht das nicht im Alleingang -- eine neue Partie braucht alle, die
  // mitspielen sollen. Dort fuehrt der Weg zurueck in den Warteraum, wo der
  // Wirt neu startet, sobald wieder alle da sind.
  onNewGame: () => {
    if (room !== null) {
      session?.stop()
      session = null
      $('menu').hidden = false
      $('table').hidden = true
      menu.open('room')
      return
    }

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
