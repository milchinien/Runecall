/**
 * Die Online-Partie -- dieselbe Sitzung, nur mit dem Server als Wahrheit.
 *
 * Gegen Bots rechnet der Client selbst (session.ts). Online tut er das
 * ausdruecklich **nicht**: Er schickt Absichten hin und zeichnet, was
 * zurueckkommt. Der Unterschied ist nicht Bequemlichkeit, sondern der Punkt
 * der Uebung -- ein Client, der den ganzen Zustand kennt, kennt auch alle
 * Haende, und damit waere Runecall kaputt.
 *
 * Nach aussen sieht man davon nichts: Was hier entsteht, erfuellt dieselbe
 * `Session` wie das lokale Spiel, also laeuft die gesamte Tischansicht
 * unveraendert weiter.
 */

import type { CardId, PlayerView, Suit } from '@runecall/engine'
import type { ClientMessage, Lobby, RefusalCode, RoomRules, ServerMessage } from '@runecall/protocol'

import { friendsMatch, type MatchConfig } from './match.ts'
import type { Session, Waiting } from './session.ts'
import type { Settings } from './settings.ts'

/* ------------------------------------------------------------------ *
 * Wo der Server steht
 * ------------------------------------------------------------------ */

/**
 * Die Adresse des Servers.
 *
 * Kommt aus der Umgebung, damit dieselbe Codebasis gegen den oertlichen
 * `wrangler dev` und gegen den veroeffentlichten Worker laeuft, ohne dass
 * jemand vor dem Hochladen eine Zeile aendert.
 */
const SERVER_URL: string =
  (import.meta.env['VITE_SERVER_URL'] as string | undefined) ??
  'https://runecall-server.milchinien.workers.dev'

function socketUrl(code: string): string {
  const base = SERVER_URL.replace(/^http/, 'ws').replace(/\/$/, '')
  return `${base}/room/${code}`
}

/* ------------------------------------------------------------------ *
 * Der Platzanspruch
 * ------------------------------------------------------------------ */

/**
 * Wer neu laedt, will auf seinen Platz zurueck -- nicht auf einen neuen.
 *
 * Das Merkmal gilt je Raum und liegt im `sessionStorage`: Es soll den
 * Seitenwechsel ueberleben, aber nicht den naechsten Besuch. Ein Anspruch auf
 * einen Platz in einem Raum von gestern hilft niemandem.
 */
const tokenKey = (code: string): string => `runecall.token.${code}`

function readToken(code: string): string | undefined {
  try {
    return window.sessionStorage.getItem(tokenKey(code)) ?? undefined
  } catch {
    return undefined
  }
}

function writeToken(code: string, token: string): void {
  try {
    window.sessionStorage.setItem(tokenKey(code), token)
  } catch {
    // Privater Modus ohne Speicher. Dann gibt es eben keinen Anspruch --
    // spielbar bleibt es, nur das Wiederkommen wird ungemuetlicher.
  }
}

/* ------------------------------------------------------------------ *
 * Was ein Raum nach aussen ist
 * ------------------------------------------------------------------ */

export type RoomStatus = 'connecting' | 'lobby' | 'playing' | 'closed'

export type Room = {
  readonly code: string
  status(): RoomStatus
  lobby(): Lobby | null
  /** Der eigene Platz, oder -1 solange noch keiner zugeteilt ist. */
  seat(): number
  /** Ob man die Regeln bestimmen und starten darf. */
  isHost(): boolean
  setRules(rules: RoomRules): void
  start(): void
  /** Die laufende Partie -- erst da, wenn der Wirt gestartet hat. */
  session(): Session | null
  leave(): void
}

export type RoomHandlers = {
  /** Der Raum hat sich geaendert: jemand kam, ging, oder die Regeln stehen anders. */
  readonly onLobby: (lobby: Lobby) => void
  /** Die Partie hat begonnen. Ab jetzt liefert `session()` etwas. */
  readonly onStart: (session: Session) => void
  /** Der Server laesst uns nicht herein. */
  readonly onRefused: (reason: RefusalCode) => void
  /** Die Verbindung ist weg und kommt nicht wieder. */
  readonly onClosed: (reason: string) => void
  /** Ein Zug wurde abgelehnt -- sollte nicht vorkommen, steht aber im Weg. */
  readonly onRejected: (message: string) => void
}

export type RoomOptions = {
  readonly code: string
  readonly name: string
  /** Ob der Raum angelegt werden soll, falls es ihn noch nicht gibt. */
  readonly create: boolean
  readonly rules?: RoomRules
  readonly settings: Settings
  /** Wird nach jeder Aenderung am Spielstand gerufen -- die Oberflaeche zeichnet dann neu. */
  readonly onChange: () => void
}

/* ------------------------------------------------------------------ *
 * Verbinden
 * ------------------------------------------------------------------ */

/** Wie lange zwischen zwei Verbindungsversuchen gewartet wird. */
const RETRY_MS = [500, 1000, 2000, 4000, 8000] as const
/** Wie oft es probiert wird, bevor der Raum als verloren gilt. */
const RETRY_LIMIT = RETRY_MS.length
/** Ein Lebenszeichen, damit die Verbindung nicht wegen Stille zugeht. */
const PING_MS = 25_000

export function joinRoom(options: RoomOptions, handlers: RoomHandlers): Room {
  const { code, name, create, settings } = options

  let ws: WebSocket | null = null
  let status: RoomStatus = 'connecting'
  let lobby: Lobby | null = null
  let seat = -1
  let token = readToken(code)
  let attempt = 0
  let closedByUs = false
  let retryTimer: number | null = null
  let pingTimer: number | null = null

  let session: OnlineSession | null = null

  function connect(): void {
    if (closedByUs) return

    const socket = new WebSocket(socketUrl(code))
    ws = socket

    socket.addEventListener('open', () => {
      attempt = 0
      const hello: ClientMessage = {
        type: 'hello',
        name,
        // Beim Wiederverbinden nie neu anlegen: Der Raum steht dann schon,
        // und ein zweites Anlegen wuerde ihn im schlimmsten Fall leeren.
        create: create && token === undefined,
        ...(options.rules !== undefined ? { rules: options.rules } : {}),
        ...(token !== undefined ? { token } : {}),
      }
      socket.send(JSON.stringify(hello))

      pingTimer = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping' } satisfies ClientMessage))
        }
      }, PING_MS)
    })

    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') return
      let msg: ServerMessage
      try {
        msg = JSON.parse(event.data) as ServerMessage
      } catch {
        return
      }
      receive(msg)
    })

    socket.addEventListener('close', () => {
      stopPing()
      if (closedByUs || status === 'closed') return

      // Eine Absage hat den Raum schon geschlossen; alles andere ist ein
      // Abbruch, und der wird erst einmal fuer einen Aussetzer gehalten.
      attempt += 1
      if (attempt > RETRY_LIMIT) {
        status = 'closed'
        handlers.onClosed('Verbindung zum Server verloren.')
        return
      }

      const wait = RETRY_MS[attempt - 1] ?? 8000
      retryTimer = window.setTimeout(connect, wait)
    })
  }

  function receive(msg: ServerMessage): void {
    switch (msg.type) {
      case 'welcome':
        seat = msg.seat
        token = msg.token
        writeToken(code, msg.token)
        applyLobby(msg.lobby)
        return

      case 'lobby':
        applyLobby(msg.lobby)
        return

      case 'view':
        applyView(msg.view, msg.names, msg.sync === true)
        return

      case 'refused':
        closedByUs = true
        status = 'closed'
        handlers.onRefused(msg.reason)
        return

      case 'rejected':
        handlers.onRejected(msg.message)
        return

      case 'pong':
        return
    }
  }

  function applyLobby(next: Lobby): void {
    lobby = next
    if (status !== 'playing') status = next.started ? 'playing' : 'lobby'
    handlers.onLobby(next)
  }

  function applyView(view: PlayerView, names: readonly string[], sync: boolean): void {
    if (session === null) {
      // Die erste Sicht ist der Anfang der Partie. Sie kommt nicht vom
      // Startknopf, sondern vom Server -- auch beim Gast, der gar keinen hat.
      session = createOnlineSession({
        first: view,
        names,
        settings,
        match: matchOf(lobby, code),
        send: (msg) => sendMessage(msg),
        onChange: options.onChange,
      })
      status = 'playing'
      handlers.onStart(session)
      return
    }

    session.receive(view, names, sync)
  }

  function sendMessage(msg: ClientMessage): void {
    if (ws !== null && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }

  function stopPing(): void {
    if (pingTimer !== null) window.clearInterval(pingTimer)
    pingTimer = null
  }

  connect()

  return {
    code,
    status: () => status,
    lobby: () => lobby,
    seat: () => seat,
    isHost: () => lobby !== null && seat >= 0 && lobby.hostSeat === seat,
    setRules: (rules) => sendMessage({ type: 'set-rules', rules }),
    start: () => sendMessage({ type: 'start' }),
    session: () => session,

    leave() {
      closedByUs = true
      status = 'closed'
      stopPing()
      if (retryTimer !== null) window.clearTimeout(retryTimer)
      retryTimer = null
      session?.stop()
      session = null
      ws?.close(1000, 'verlassen')
      ws = null
    },
  }
}

/** Aus den Raumregeln den Bauplan machen, den die Oberflaeche kennt. */
function matchOf(lobby: Lobby | null, code: string): MatchConfig {
  return friendsMatch({
    playerCount: lobby?.rules.playerCount ?? 4,
    difficulty: lobby?.rules.difficulty ?? 'normal',
    rounds: lobby?.rules.rounds ?? null,
    roomCode: code,
  })
}

/* ------------------------------------------------------------------ *
 * Die Sitzung am Netz
 * ------------------------------------------------------------------ */

type OnlineSession = Session & {
  /** Ein neuer Stand vom Server. */
  receive(view: PlayerView, names: readonly string[], sync: boolean): void
}

type OnlineOptions = {
  readonly first: PlayerView
  readonly names: readonly string[]
  readonly settings: Settings
  readonly match: MatchConfig
  readonly send: (msg: ClientMessage) => void
  readonly onChange: () => void
}

/**
 * Die Sitzung, die nicht rechnet, sondern zusieht.
 *
 * Ein Punkt verdient Erklaerung: die **Warteschlange**. Der Server schickt
 * nach jedem einzelnen Zug eine Sicht, also treffen waehrend eines Stichs
 * mehrere kurz hintereinander ein -- oft im selben Sekundenbruchteil. Wuerde
 * der Client jede sofort zeichnen, saehe man nicht vier Karten fliegen,
 * sondern einen fertigen Stich. Die Zuege werden deshalb hier
 * aufgereiht und im eingestellten Tempo abgespielt.
 *
 * Die Zeit gehoert also weiterhin der Oberflaeche, nicht dem Server -- genau
 * wie im lokalen Spiel, wo dieselben Pausen in session.ts stehen.
 */
function createOnlineSession(options: OnlineOptions): OnlineSession {
  const { settings, match, send, onChange } = options

  let view: PlayerView = options.first
  let names: readonly string[] = label(options.names, options.first.you)
  let waiting: Waiting = 'none'
  let stopped = false

  const queue: PlayerView[] = []
  let timer: number | null = null
  let pending: (() => void) | null = null

  const trickPause = Math.max(700, Math.round(settings.speed * 1.25))

  function schedule(ms: number, run: () => void): void {
    cancel()
    pending = run
    timer = window.setTimeout(() => {
      timer = null
      pending = null
      if (!stopped) run()
    }, ms)
  }

  function cancel(): void {
    if (timer !== null) window.clearTimeout(timer)
    timer = null
    pending = null
  }

  /**
   * Den naechsten aufgereihten Stand zeigen -- und entscheiden, wie lange er
   * stehen bleibt.
   */
  function drain(): void {
    if (stopped) return

    const next = queue.shift()
    if (next === undefined) {
      waiting = 'none'
      onChange()
      return
    }

    const freshTrick = next.lastTrick !== null && next.lastTrick !== view.lastTrick
    view = next

    if (freshTrick) {
      // Der gewonnene Stich bleibt liegen, bevor er eingesammelt wird --
      // dieselbe Pause wie im lokalen Spiel (Frage 16).
      waiting = 'trick'
      onChange()
      schedule(trickPause, drain)
      return
    }

    if (queue.length > 0) {
      // Es warten weitere Zuege. Zwischen zwei Karten liegt das eingestellte
      // Tempo, sonst sieht man nicht, wer was gelegt hat.
      waiting = 'bot'
      onChange()
      schedule(settings.speed, drain)
      return
    }

    waiting = 'none'
    onChange()
  }

  return {
    settings,
    match,
    get names() {
      return names
    },
    view: () => view,
    waiting: () => waiting,

    receive(next, nextNames, sync) {
      if (stopped) return
      names = label(nextNames, next.you)

      if (sync) {
        // Ein Aufsetzpunkt. Was noch in der Schlange stand, gehoert zu einem
        // Verlauf, den es so nicht mehr gibt.
        queue.length = 0
        cancel()
        view = next
        waiting = 'none'
        onChange()
        return
      }

      queue.push(next)
      // Laeuft schon eine Pause, haengt sich der neue Stand hinten an. Sonst
      // beginnt das Abspielen sofort.
      if (timer === null) drain()
    },

    // Die Zuege gehen hinaus und kommen als Sicht zurueck. Bewusst ohne
    // Vorgriff: Was der Client vorwegnehmen wuerde, muesste er zuruecknehmen,
    // wenn der Server anderer Meinung ist.
    chooseTrump(suit: Suit) {
      send({ type: 'action', action: { type: 'choose-trump', suit } })
    },

    bid(value: number) {
      send({ type: 'action', action: { type: 'bid', value } })
    },

    play(cardId: CardId) {
      if (waiting !== 'none') return
      send({ type: 'action', action: { type: 'play', cardId } })
    },

    nextRound() {
      send({ type: 'action', action: { type: 'next-round' } })
    },

    skip() {
      const run = pending
      if (run === null) return
      cancel()
      run()
    },

    stop() {
      stopped = true
      cancel()
      queue.length = 0
    },
  }
}

/** Der eigene Platz heisst "Du" -- darauf verlaesst sich die Darstellung. */
function label(source: readonly string[], you: number): readonly string[] {
  return source.map((name, seat) => (seat === you ? 'Du' : name))
}
