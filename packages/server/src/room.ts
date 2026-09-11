/**
 * Ein Raum -- und damit die Wahrheit ueber eine Partie.
 *
 * Hier liegt der vollstaendige `GameState`. Er verlaesst dieses Objekt nie:
 * Was hinausgeht, ist immer `playerView(state, seat)`, also die Sicht genau
 * eines Spielers. Das ist bei einem Spiel mit verdeckten Karten keine
 * Feinheit, sondern der Grund, warum es diesen Server ueberhaupt gibt
 * (docs/00-ENTSCHEIDUNGEN.md, "Der Server muss autoritativ sein").
 *
 * Der Raum prueft ausserdem jeden Zug selbst, mit derselben Engine, die auch
 * in den Tests laeuft. Die Pruefung im Client ist Bequemlichkeit fuer den
 * Spieler, nicht die Absicherung.
 */

import {
  RuleError,
  applyAction,
  createGame,
  playerView,
  roundCount,
  type Action,
  type GameState,
} from '@runecall/engine'
import { createBot, type Difficulty } from '@runecall/bots'
import type {
  ClientMessage,
  Lobby,
  Occupant,
  RefusalCode,
  RoomRules,
  ServerMessage,
} from '@runecall/protocol'

/* ------------------------------------------------------------------ *
 * Was ein Raum sich merkt
 * ------------------------------------------------------------------ */

type SeatRecord =
  /** Ein Mensch. `token` ist sein Anspruch auf diesen Platz beim Neuladen. */
  | { readonly kind: 'human'; readonly name: string; readonly token: string }
  | { readonly kind: 'bot'; readonly name: string }
  | { readonly kind: 'empty' }

type Persisted = {
  readonly code: string
  readonly rules: RoomRules
  /** Der Anspruch des Wirts -- ein Platz kann wechseln, der Anspruch nicht. */
  readonly hostToken: string
  readonly seats: readonly SeatRecord[]
  readonly started: boolean
  readonly game: GameState | null
}

/** Was an einer offenen Verbindung haengt. */
type Attachment = { readonly seat: number; readonly token: string }

/** Namen fuer Bots (Entscheidung 2.17). */
const BOT_NAMES = ['Ben', 'Chris', 'Dana', 'Emil', 'Fee', 'Gil'] as const

/**
 * Wann ein vergessener Raum verschwindet.
 *
 * Raeume, in denen niemand mehr etwas tut, sollen nicht ewig Speicher
 * belegen. Zwoelf Stunden sind grosszuegig genug, dass eine Partie mit einer
 * langen Pause dazwischen ueberlebt.
 */
const IDLE_MS = 12 * 60 * 60 * 1000

/**
 * Wie lange ein Ersatzbot wartet, bevor er fuer einen Getrennten zieht.
 *
 * Null waere richtig und fuehlte sich falsch an: Wer gerade die Verbindung
 * verloren hat, soll eine Chance haben zurueckzukommen, bevor sein Blatt
 * ohne ihn weitergespielt wird.
 */
const TAKEOVER_MS = 2500

export class RoomDO implements DurableObject {
  readonly #state: DurableObjectState
  #room: Persisted | null = null

  constructor(state: DurableObjectState) {
    this.#state = state

    // Nach dem Aufwachen aus dem Winterschlaf ist der Speicher leer. Erst
    // laden, dann irgendetwas beantworten -- sonst haelte sich ein zweiter
    // Aufruf fuer den ersten und legte den Raum neu an.
    void state.blockConcurrencyWhile(async () => {
      this.#room = (await state.storage.get<Persisted>('room')) ?? null
    })
  }

  /* ---------------------------------------------------------------- *
   * Verbindung
   * ---------------------------------------------------------------- */

  async fetch(request: Request): Promise<Response> {
    const code = new URL(request.url).pathname.slice(1).toUpperCase()
    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]

    // Winterschlaf statt Dauerlauf: Das Objekt darf zwischen zwei Zuegen aus
    // dem Speicher fallen, ohne dass die Verbindungen abreissen. Nur so
    // kostet ein Raum, in dem gerade nachgedacht wird, keine Rechenzeit --
    // und nur so bleibt das im kostenlosen Tarif.
    this.#state.acceptWebSocket(server)
    server.serializeAttachment({ seat: -1, token: '' } satisfies Attachment)

    // Den Code merken wir uns beim ersten Anlegen; ein Durable Object kennt
    // seinen eigenen Namen nicht.
    await this.#state.storage.put('code', code)

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string') return

    let msg: ClientMessage
    try {
      msg = JSON.parse(raw) as ClientMessage
    } catch {
      return
    }

    try {
      await this.#handle(ws, msg)
    } catch (error) {
      if (error instanceof RuleError) {
        send(ws, { type: 'rejected', code: error.code, message: error.message })
        return
      }
      send(ws, {
        type: 'rejected',
        code: 'server',
        message: error instanceof Error ? error.message : 'Unbekannter Fehler',
      })
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const seat = seatOf(ws)
    // Der Platz bleibt bestehen -- der Spieler gilt nur als getrennt. Wer
    // neu laedt, bekommt ihn ueber sein Merkmal zurueck; solange er weg ist,
    // zieht ein Bot fuer ihn.
    if (seat >= 0) await this.#state.storage.put(`gone:${seat}`, Date.now())
    await this.#afterChange()
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws)
  }

  /**
   * Der Wecker hat zwei Aufgaben.
   *
   * Kurzfristig laeuft er, damit ein Ersatzbot zieht, wenn der Getrennte
   * nicht zurueckkommt -- ohne ihn stuende die Partie still, weil niemand da
   * ist, der den naechsten Zug ausloest. Nach langer Stille raeumt er den
   * Raum ab.
   */
  async alarm(): Promise<void> {
    const last = (await this.#state.storage.get<number>('touched')) ?? 0

    if (Date.now() - last >= IDLE_MS) {
      for (const ws of this.#state.getWebSockets()) ws.close(1000, 'Raum abgelaufen')
      await this.#state.storage.deleteAll()
      this.#room = null
      return
    }

    await this.#afterChange()
  }

  /* ---------------------------------------------------------------- *
   * Die Nachrichten
   * ---------------------------------------------------------------- */

  async #handle(ws: WebSocket, msg: ClientMessage): Promise<void> {
    switch (msg.type) {
      case 'ping':
        return send(ws, { type: 'pong' })
      case 'hello':
        return this.#hello(ws, msg)
      case 'set-rules':
        return this.#setRules(ws, msg.rules)
      case 'start':
        return this.#start(ws)
      case 'action':
        return this.#action(ws, msg.action)
    }
  }

  async #hello(ws: WebSocket, msg: Extract<ClientMessage, { type: 'hello' }>): Promise<void> {
    const name = msg.name.trim().slice(0, 16)
    if (name.length === 0) return refuse(ws, 'bad-name')

    const code = (await this.#state.storage.get<string>('code')) ?? ''
    const token = msg.token ?? crypto.randomUUID()

    if (this.#room === null) {
      // Es gibt den Raum noch nicht. Nur wer ihn erstellen wollte, legt ihn
      // an -- ein Gast mit vertipptem Code soll nicht versehentlich einen
      // leeren Raum eroeffnen und darin auf Freunde warten, die woanders
      // sitzen.
      if (!msg.create) return refuse(ws, 'no-such-room')

      const rules = sanitizeRules(msg.rules)
      const seats: SeatRecord[] = Array.from({ length: rules.playerCount }, () => ({
        kind: 'empty' as const,
      }))
      seats[0] = { kind: 'human', name, token }

      this.#room = { code, rules, hostToken: token, seats, started: false, game: null }
      await this.#seat(ws, 0, token)
      return this.#afterChange()
    }

    const room = this.#room

    // Ein bekanntes Merkmal holt den alten Platz zurueck -- beim Neuladen
    // der Seite und nach jedem Verbindungsabbruch.
    const known = room.seats.findIndex((seat) => seat.kind === 'human' && seat.token === token)
    if (known >= 0) {
      await this.#seat(ws, known, token)
      return this.#afterChange()
    }

    // Ab hier ist es jemand Neues.
    if (room.started) return refuse(ws, 'already-started')

    const free = room.seats.findIndex((seat) => seat.kind === 'empty')
    if (free < 0) return refuse(ws, 'room-full')

    const seats = room.seats.slice()
    seats[free] = { kind: 'human', name, token }
    this.#room = { ...room, seats }

    await this.#seat(ws, free, token)
    return this.#afterChange()
  }

  /** Eine Verbindung an einen Platz binden und ihr das mitteilen. */
  async #seat(ws: WebSocket, seat: number, token: string): Promise<void> {
    ws.serializeAttachment({ seat, token } satisfies Attachment)
    await this.#state.storage.delete(`gone:${seat}`)
    send(ws, { type: 'welcome', seat, token, lobby: this.#lobby() })

    // Wer gerade erst hereinkommt, hat keine Vorgeschichte zum Abspielen.
    // Er bekommt den Stand, wie er ist -- als Aufsetzpunkt, nicht als Schritt.
    const room = this.#room
    if (room?.game != null) {
      send(ws, {
        type: 'view',
        view: playerView(room.game, seat),
        names: this.#names(),
        sync: true,
      })
    }
  }

  async #setRules(ws: WebSocket, incoming: RoomRules): Promise<void> {
    const room = this.#room
    if (room === null || room.started) return
    if (seatOf(ws) !== this.#hostSeat()) return

    const rules = sanitizeRules(incoming)

    // Die Spielerzahl aendert die Zahl der Plaetze. Menschen ruecken dabei
    // nach vorn zusammen, statt ins Leere zu fallen: Wer schon im Raum ist,
    // soll nicht hinausfliegen, weil der Wirt an einem Regler dreht.
    const humans = room.seats.filter((seat) => seat.kind === 'human')
    const count = Math.max(rules.playerCount, humans.length)
    const seats: SeatRecord[] = Array.from(
      { length: count },
      (_, i) => humans[i] ?? { kind: 'empty' },
    )

    this.#room = { ...room, rules: { ...rules, playerCount: count }, seats }

    // Die Plaetze haben sich verschoben, also stimmt an den offenen
    // Verbindungen die Platznummer nicht mehr.
    await this.#reseat()
    return this.#afterChange()
  }

  /** Jede Verbindung wieder auf den Platz zeigen lassen, auf dem ihr Merkmal sitzt. */
  async #reseat(): Promise<void> {
    const room = this.#room
    if (room === null) return

    for (const ws of this.#state.getWebSockets()) {
      const attached = ws.deserializeAttachment() as Attachment | null
      if (attached === null || attached.token === '') continue

      const seat = room.seats.findIndex(
        (record) => record.kind === 'human' && record.token === attached.token,
      )
      if (seat >= 0 && seat !== attached.seat) {
        ws.serializeAttachment({ seat, token: attached.token } satisfies Attachment)
      }
    }
  }

  async #start(ws: WebSocket): Promise<void> {
    const room = this.#room
    if (room === null || room.started) return
    if (seatOf(ws) !== this.#hostSeat()) return

    // Freie Plaetze uebernehmen Bots. Weil Server und Bots dieselbe Engine
    // benutzen, ist das kein Sonderfall, sondern derselbe Zug aus einer
    // anderen Hand (docs/04-TECHNIK-EMPFEHLUNG.md).
    let botIndex = 0
    const seats = room.seats.map((seat): SeatRecord => {
      if (seat.kind !== 'empty') return seat
      const name = BOT_NAMES[botIndex % BOT_NAMES.length] ?? `Bot ${botIndex + 1}`
      botIndex += 1
      return { kind: 'bot', name }
    })

    const playerCount = seats.length
    const max = roundCount(playerCount)
    const wanted = room.rules.rounds
    const totalRounds = wanted === null || wanted > max ? max : wanted

    // Den Startwert vergibt der Server (Entscheidung 31). Er wird nirgends
    // angezeigt -- wer ihn kennt, kennt die Verteilung.
    const seed = Math.floor(Math.random() * 0x7fffffff)
    const game = createGame({ playerCount, totalRounds, seed })

    this.#room = { ...room, seats, started: true, game }
    return this.#afterChange()
  }

  async #action(ws: WebSocket, action: Action): Promise<void> {
    const room = this.#room
    if (room === null || room.game === null) return

    const seat = seatOf(ws)
    if (seat < 0) return

    const game = room.game

    // Der eigene Zug muss der eigene sein. Beim Rundenwechsel ist niemand
    // "am Zug" -- dort darf jeder weiterklicken, der noch im Raum sitzt.
    if (action.type !== 'next-round' && moverOf(game) !== seat) {
      throw new RuleError('not-your-turn', `Platz ${seat} ist nicht am Zug`)
    }

    this.#room = { ...room, game: applyAction(game, action) }
    return this.#afterChange()
  }

  /* ---------------------------------------------------------------- *
   * Nach jeder Aenderung
   * ---------------------------------------------------------------- */

  /**
   * Bots ziehen lassen, sichern, allen Bescheid sagen.
   *
   * Die Reihenfolge ist kein Zufall: Erst wird der Zustand fertig gerechnet,
   * dann festgeschrieben, dann verschickt. Wer es andersherum macht,
   * verschickt einen Stand, den ein Absturz gleich darauf vergisst.
   */
  async #afterChange(): Promise<void> {
    // Erst der Stand, wie er nach dem menschlichen Zug ist, dann jeder
    // Bot-Zug einzeln: `#runBots` meldet jeden Schritt fuer sich, damit im
    // Client jede Karte einzeln auf den Tisch fliegt statt alle auf einmal.
    this.#broadcast()
    const again = await this.#runBots()

    if (this.#room !== null) await this.#state.storage.put('room', this.#room)
    await this.#state.storage.put('touched', Date.now())

    // Wartet die Partie auf einen Getrennten, muss der Wecker sie wieder
    // anstossen; sonst laeuft nur noch die lange Aufraeumfrist.
    await this.#state.storage.setAlarm(Date.now() + (again ? TAKEOVER_MS : IDLE_MS))
  }

  /**
   * Alle Zuege machen, die kein anwesender Mensch machen wird.
   *
   * Das betrifft zwei Faelle, die sich hier nicht unterscheiden: einen Bot
   * auf einem freien Platz und einen Menschen, der gerade weg ist
   * (Entscheidung "Vertretung bei Verbindungsabbruch"). In beiden Faellen
   * zieht derselbe Bot mit derselben Sicht.
   *
   * Liefert `true`, wenn noch auf jemanden gewartet wird, der nicht da ist.
   */
  async #runBots(): Promise<boolean> {
    const room = this.#room
    if (room === null || room.game === null) return false

    let game = room.game
    let waiting = false
    const connected = this.#connectedSeats()

    // Der Ablauf ist endlich, aber eine Schranke kostet nichts und verhindert,
    // dass ein Denkfehler den Worker endlos drehen laesst.
    for (let guard = 0; guard < 500; guard += 1) {
      const mover = moverOf(game)
      if (mover < 0) break

      const seat = room.seats[mover]
      if (seat === undefined) break

      // Ein anwesender Mensch zieht selbst -- hier ist Schluss.
      if (seat.kind === 'human' && connected.has(mover)) break

      // Ein getrennter Mensch bekommt einen Moment, zurueckzukommen.
      if (seat.kind === 'human') {
        const since = (await this.#state.storage.get<number>(`gone:${mover}`)) ?? Date.now()
        if (Date.now() - since < TAKEOVER_MS) {
          waiting = true
          break
        }
      }

      const bot = createBot(room.rules.difficulty, game.seed + mover * 7919 + game.roundNumber)
      const view = playerView(game, mover)

      game =
        game.phase === 'trump-choice'
          ? applyAction(game, { type: 'choose-trump', suit: bot.chooseTrump(view) })
          : game.phase === 'bidding'
            ? applyAction(game, { type: 'bid', value: bot.chooseBid(view) })
            : applyAction(game, { type: 'play', cardId: bot.chooseCard(view) })

      this.#room = { ...room, game }
      this.#broadcast()
    }

    this.#room = { ...room, game }
    return waiting
  }

  /* ---------------------------------------------------------------- *
   * Auskunft
   * ---------------------------------------------------------------- */

  #connectedSeats(): Set<number> {
    const seats = new Set<number>()
    for (const ws of this.#state.getWebSockets()) {
      const seat = seatOf(ws)
      if (seat >= 0) seats.add(seat)
    }
    return seats
  }

  /**
   * Wer gerade bestimmt.
   *
   * Normalerweise der, der den Raum erstellt hat. Ist er weg, uebernimmt der
   * naechste Anwesende -- sonst haenge der Raum fest, nur weil dem Wirt das
   * Netz weggebrochen ist.
   */
  #hostSeat(): number {
    const room = this.#room
    if (room === null) return -1

    const owner = room.seats.findIndex(
      (seat) => seat.kind === 'human' && seat.token === room.hostToken,
    )
    const connected = this.#connectedSeats()
    if (owner >= 0 && connected.has(owner)) return owner

    const standIn = room.seats.findIndex(
      (seat, index) => seat.kind === 'human' && connected.has(index),
    )
    return standIn >= 0 ? standIn : owner
  }

  #lobby(): Lobby {
    const room = this.#room
    if (room === null) throw new Error('Kein Raum')

    const connected = this.#connectedSeats()
    const seats: Occupant[] = room.seats.map((seat, index) =>
      seat.kind === 'human'
        ? { kind: 'human', name: seat.name, connected: connected.has(index) }
        : seat.kind === 'bot'
          ? { kind: 'bot', name: seat.name }
          : { kind: 'empty' },
    )

    return {
      code: room.code,
      rules: room.rules,
      hostSeat: this.#hostSeat(),
      seats,
      started: room.started,
    }
  }

  #names(): string[] {
    const room = this.#room
    if (room === null) return []
    return room.seats.map((seat, index) =>
      seat.kind === 'empty' ? `Platz ${index + 1}` : seat.name,
    )
  }

  /**
   * Jedem schicken, was ihn angeht.
   *
   * Kein Rundruf mit einem gemeinsamen Stand: Jede Verbindung bekommt ihre
   * eigene `playerView`, und die unterscheiden sich genau in dem, was geheim
   * ist.
   */
  #broadcast(sync = false): void {
    const room = this.#room
    if (room === null) return

    const lobby = this.#lobby()
    const names = this.#names()

    for (const ws of this.#state.getWebSockets()) {
      const seat = seatOf(ws)
      if (seat < 0) continue

      send(ws, { type: 'lobby', lobby })
      if (room.game !== null) {
        send(ws, { type: 'view', view: playerView(room.game, seat), names, sync })
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * Kleinkram
 * ------------------------------------------------------------------ */

function seatOf(ws: WebSocket): number {
  const attached = ws.deserializeAttachment() as Attachment | null
  return attached?.seat ?? -1
}

/** Wer als Naechstes ziehen muss, oder -1, wenn gerade niemand dran ist. */
function moverOf(game: GameState): number {
  switch (game.phase) {
    case 'trump-choice':
      return game.dealer
    case 'bidding':
    case 'playing':
      return game.turn
    // Am Rundenende und am Partieende wartet die Partie auf einen Menschen,
    // nicht auf einen Zug. Ein Bot soll hier nicht weiterklicken -- die
    // Wertung will gelesen werden.
    case 'round-end':
    case 'game-over':
      return -1
  }
}

/**
 * Was der Client an Regeln schickt, ist ein Wunsch, keine Tatsache.
 *
 * Der Server nimmt nur, was das Regelwerk hergibt -- sonst stuende hier eine
 * Partie zu siebzehnt oder ueber minus drei Runden.
 */
function sanitizeRules(rules: RoomRules | undefined): RoomRules {
  const difficulties: readonly Difficulty[] = ['easy', 'normal', 'hard']
  const playerCount = Math.min(6, Math.max(3, Math.floor(rules?.playerCount ?? 4)))
  const wanted = rules?.rounds
  const rounds =
    wanted === null || wanted === undefined || !Number.isFinite(wanted)
      ? null
      : Math.min(roundCount(playerCount), Math.max(1, Math.floor(wanted)))
  const difficulty = rules?.difficulty

  return {
    playerCount,
    rounds,
    difficulty: difficulty !== undefined && difficulties.includes(difficulty) ? difficulty : 'normal',
  }
}

function send(ws: WebSocket, msg: ServerMessage): void {
  try {
    ws.send(JSON.stringify(msg))
  } catch {
    // Eine Verbindung, die im selben Moment weggebrochen ist. Der naechste
    // Rundruf laesst sie aus -- hier ist nichts zu retten und nichts zu melden.
  }
}

function refuse(ws: WebSocket, reason: RefusalCode): void {
  send(ws, { type: 'refused', reason })
  ws.close(1008, reason)
}
