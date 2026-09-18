/**
 * Das Menue -- ein Stapel von Bildschirmen vor dem Raum.
 *
 * Frueher stand alles auf einer Tafel: Spielerzahl, Gegner, Tempo, Hilfen und
 * ein Knopf "Neue Partie". Das ging, solange es nur eine Art zu spielen gab.
 * Jetzt gibt es zwei -- die gewertete Partie aus der Spielersuche und den
 * eigenen Raum mit Freunden -- und die unterscheiden sich gerade darin, was
 * man einstellen darf. Beides auf eine Tafel zu legen hiesse, die Haelfte der
 * Knoepfe mal zu sperren und mal nicht.
 *
 * Deshalb Bildschirme, jeder mit einer Frage:
 *
 *     Start ─┬─ Spielen ─┬─ Freund beitreten   (Raumcode eingeben)
 *            │           └─ Spielersuche ─── Ranked ─── Suche laeuft
 *            ├─ Spiel erstellen                (eigener Raum, alles frei)
 *            ├─ Einstellungen
 *            └─ Spiel beenden
 *
 * Zurueck fuehrt immer eine Stufe hoeher, auch mit Escape.
 *
 * **Der eigene Raum laeuft ueber das Netz** (online.ts, packages/server):
 * "Raum eroeffnen" und "Freund beitreten" fuehren beide in denselben
 * Wartebildschirm, in dem steht, wer schon da ist. Erst wenn der Wirt
 * startet, geht es an den Tisch.
 *
 * **Die Spielersuche ist noch ohne Netz.** Sie braucht eine Vermittlung
 * ueber alle Raeume hinweg, nicht nur einen Raum; bis es sie gibt, sucht sie
 * sichtbar, findet niemanden und laesst Bots einspringen -- genau das, was
 * sie spaeter auch tut, wenn zu dieser Zeit wirklich niemand sucht.
 */

import { DIFFICULTIES, type Difficulty } from '@runecall/bots'
import { roundCount } from '@runecall/engine'

import {
  RANKED_PLAYERS,
  RANKED_ROUNDS,
  createRoomCode,
  friendsMatch,
  isRoomCode,
  normalizeRoomCode,
  rankedMatch,
  ROOM_CODE_LENGTH,
  type MatchConfig,
} from './match.ts'
import { clearInvite, inviteLink, readInviteCode, showInvite } from './invite.ts'
import type { Room } from './online.ts'
import { RANK_POINTS, loadRank, nextTier, ordinal, plural, tierOf } from './rank.ts'
import { DIFFICULTY_LABEL, SPEED_OPTIONS, type Settings } from './settings.ts'
import { showToast } from './ui.ts'

export type MenuScreen =
  | 'home'
  | 'play'
  | 'search'
  | 'queue'
  | 'create'
  | 'join'
  | 'room'
  | 'settings'
  | 'quit'

export type MenuDeps = {
  readonly settings: () => Settings
  /** Aendert Einstellungen und sichert sie. */
  readonly change: (patch: Partial<Settings>) => void
  readonly hasSave: () => boolean
  readonly resume: () => void
  readonly start: (match: MatchConfig) => void
  /**
   * Einen Raum oeffnen oder betreten.
   *
   * Das Menue verbindet sich nicht selbst -- es sagt nur, was es will. Die
   * Verbindung haelt main.ts, weil sie den Bildschirmwechsel ueberlebt.
   */
  readonly openRoom: (options: { readonly create: boolean; readonly code: string }) => void
  readonly leaveRoom: () => void
  /** Der Raum, in dem man gerade sitzt -- `null`, wenn keiner. */
  readonly room: () => Room | null
  /** Was zuletzt schiefging, wenn der Server nicht mitspielt. */
  readonly roomNote: () => string | null
  /** Versucht, das Fenster zu schliessen. */
  readonly quit: () => void
}

export type Menu = {
  /** Zeigt das Menue, wahlweise auf einem bestimmten Bildschirm. */
  open: (screen?: MenuScreen) => void
  close: () => void
  screen: () => MenuScreen
  /**
   * Neu zeichnen, ohne den Bildschirm zu wechseln.
   *
   * Gebraucht fuer den Wartebildschirm: Dort aendert sich der Inhalt, weil
   * jemand anders etwas tut, nicht weil hier jemand klickt.
   */
  refresh: () => void
}

/**
 * Wie lange die Spielersuche sucht, bevor Bots einspringen.
 *
 * Lang genug, dass man sieht, dass gesucht wurde -- kurz genug, dass es sich
 * nicht nach Warteschlange anfuehlt. Sobald der Server steht, endet die Suche
 * nicht mehr nach dieser Zeit, sondern wenn genug Leute da sind.
 */
const SEARCH_MS = 3800
/** Der Moment, in dem "keine Spieler gefunden" lesbar ist, bevor es losgeht. */
const FALLBACK_MS = 1400

export function createMenu(root: HTMLElement, deps: MenuDeps): Menu {
  /**
   * Wer ueber einen Einladungslink kommt, will beitreten -- nicht erst durch
   * zwei Bildschirme klicken und den Code abtippen, den er schon mitbringt.
   */
  const invited = readInviteCode()

  let screen: MenuScreen = invited === null ? 'home' : 'join'
  let timer: number | null = null

  /** Was auf dem Beitreten-Bildschirm steht und was zuletzt herauskam. */
  let joinCode = invited ?? ''
  let joinNote: string | null = null
  /** Wie weit die Spielersuche ist. */
  let searchState: 'searching' | 'filling' = 'searching'
  /** Ob schon versucht wurde, das Fenster zu schliessen. */
  let quitTried = false

  /**
   * Eine Einstellung aendern heisst hier immer: sichern und neu zeichnen.
   *
   * Die Knoepfe zeigen den gespeicherten Stand an -- ohne das zweite haette
   * man geklickt und saehe weiter den alten Wert markiert.
   */
  function change(patch: Partial<Settings>): void {
    deps.change(patch)
    render()
  }

  /**
   * Den Einladungslink in die Zwischenablage.
   *
   * Der Code steht daneben immer noch da: Wo die Zwischenablage gesperrt ist
   * -- und das ist sie ohne HTTPS -- bleibt das Abtippen der Weg.
   */
  function copyInvite(code: string): void {
    void navigator.clipboard
      ?.writeText(inviteLink(code))
      .then(() => showToast('Invite link copied'))
      .catch(() => showToast('Could not copy — just tell them the code'))
  }

  function isOpen(): boolean {
    const menu = root.closest('.menu')
    return menu !== null && !menu.hasAttribute('hidden')
  }

  function stopTimer(): void {
    if (timer !== null) window.clearTimeout(timer)
    timer = null
  }

  function go(next: MenuScreen): void {
    stopTimer()
    screen = next
    if (next !== 'join') {
      joinCode = ''
      joinNote = null
    }
    if (next !== 'quit') quitTried = false
    render()
  }

  /** Eine Stufe hoeher -- der Weg, den Escape und jeder Zurueck-Knopf nimmt. */
  function back(): void {
    const up: Record<MenuScreen, MenuScreen> = {
      home: 'home',
      play: 'home',
      search: 'play',
      queue: 'search',
      create: 'home',
      join: 'play',
      room: 'home',
      settings: 'home',
      quit: 'home',
    }

    // Aus dem Wartebildschirm zurueck heisst: den Raum verlassen. Ihn offen
    // im Hintergrund zu lassen, waere das eine, was man hier nicht erwartet.
    if (screen === 'room') {
      deps.leaveRoom()
      clearInvite()
    }
    go(up[screen])
  }

  /* ---------------------------------------------------------------- *
   * Bildschirme
   * ---------------------------------------------------------------- */

  function render(): void {
    root.replaceChildren(build())
    // Die Tafel wird auf tiefen Bildschirmen schmaler und der Titel kleiner:
    // Auf der Startseite ist der Name die Hauptsache, danach der Inhalt.
    root.closest('.menu__panel')?.classList.toggle('is-deep', screen !== 'home')
  }

  function build(): HTMLElement {
    switch (screen) {
      case 'home':
        return homeScreen()
      case 'play':
        return playScreen()
      case 'search':
        return searchScreen()
      case 'queue':
        return queueScreen()
      case 'create':
        return createScreen()
      case 'join':
        return joinScreen()
      case 'room':
        return roomScreen()
      case 'settings':
        return settingsScreen()
      case 'quit':
        return quitScreen()
    }
  }

  function homeScreen(): HTMLElement {
    const box = section()

    if (deps.hasSave()) {
      box.append(
        bigButton('Resume game', 'You have an unfinished game', deps.resume),
      )
    }

    box.append(
      bigButton('Play', 'Join friends or find other players', () => go('play')),
      bigButton('Create game', 'Your own room with a code — you set the rules', () => go('create')),
      bigButton('Settings', 'Speed and assists', () => go('settings')),
      bigButton('Quit game', null, () => go('quit'), { ghost: true }),
      rankStrip(),
    )

    return box
  }

  function playScreen(): HTMLElement {
    const box = section('Play')

    box.append(
      bigButton('Join a friend', "Enter a room code to join a friend's game", () =>
        go('join'),
      ),
      bigButton('Matchmaking', 'Ranked game against other players', () => go('search')),
      backButton(),
    )

    return box
  }

  /**
   * Die Spielersuche.
   *
   * Sie zeigt eine Liste von Modi, in der bisher genau einer steht. Das ist
   * kein Versehen: Ranked ist der Modus, in dem es um etwas geht, und die
   * Liste ist der Platz, an dem spaeter weitere dazukommen -- ohne dass
   * dieser Bildschirm dafuer umgebaut werden muss.
   */
  function searchScreen(): HTMLElement {
    const box = section('Matchmaking')
    const rank = loadRank()

    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'mode'
    card.addEventListener('click', () => {
      searchState = 'searching'
      go('queue')
      startSearch()
    })

    const head = document.createElement('div')
    head.className = 'mode__head'
    head.append(
      element('b', 'mode__title', 'Ranked'),
      element('span', 'mode__badge', 'Rated'),
    )

    const rules = document.createElement('ul')
    rules.className = 'mode__rules'
    for (const line of [
      `Always ${RANKED_PLAYERS} players`,
      `Always ${RANKED_ROUNDS} rounds`,
      'Bots only fill seats that stay empty',
    ]) {
      rules.append(element('li', null, line))
    }

    const points = document.createElement('div')
    points.className = 'mode__points'
    RANK_POINTS.forEach((value, index) => {
      const cell = element('span', 'mode__point')
      cell.append(
        element('small', null, ordinal(index + 1)),
        element('b', value >= 0 ? 'is-gain' : 'is-loss', value > 0 ? `+${value}` : String(value)),
      )
      points.append(cell)
    })

    card.append(head, rules, points, element('span', 'mode__go', 'Find a match'))

    box.append(card, rankStrip(), backButton())

    if (rank.games === 0) {
      box.append(
        note('Your first ranked game decides where you start — losing it costs you nothing.'),
      )
    }

    return box
  }

  /**
   * Die laufende Suche.
   *
   * Sie tut im Moment nichts weiter als warten, und trotzdem steht sie hier
   * schon so, wie sie spaeter aussieht: erst suchen, dann melden, wie viele
   * Plaetze frei geblieben sind, dann anfangen. Was der Server aendert, ist
   * nur, woher die Zahl kommt.
   */
  function queueScreen(): HTMLElement {
    const box = section('Ranked')

    const panel = element('div', 'queue')
    const spinner = element('div', 'queue__runes')
    for (const sign of ['◆', '◆', '◆']) spinner.append(element('span', null, sign))

    const found = 1
    panel.append(
      spinner,
      element(
        'p',
        'queue__state',
        searchState === 'searching'
          ? 'Looking for players …'
          : 'No more players found — bots take the empty seats.',
      ),
      element('p', 'queue__count', `${found} of ${RANKED_PLAYERS} seats filled`),
    )

    box.append(panel)

    if (searchState === 'searching') {
      box.append(
        actionRow([
          plainButton('Cancel search', () => go('search'), { ghost: true }),
        ]),
      )
    }

    box.append(
      note(
        `Ranked: ${RANKED_PLAYERS} players, ${RANKED_ROUNDS} rounds, fixed rules. Your final place counts toward your rank.`,
      ),
    )

    return box
  }

  function startSearch(): void {
    stopTimer()
    timer = window.setTimeout(() => {
      searchState = 'filling'
      render()
      timer = window.setTimeout(() => deps.start(rankedMatch()), FALLBACK_MS)
    }, SEARCH_MS)
  }

  /**
   * Der eigene Raum.
   *
   * Hier ist alles einstellbar, weil man weiss, mit wem man spielt
   * (Lobby-Trennung in docs/00-ENTSCHEIDUNGEN.md). Der Code steht oben und
   * bleibt derselbe, bis man ihn neu wuerfelt -- ein Raum, dessen Code sich
   * bei jedem Blick aendert, laesst sich niemandem durchsagen.
   */
  function createScreen(): HTMLElement {
    const settings = deps.settings()
    const box = section('Create game')
    const code = settings.roomCode ?? createRoomCode()

    const room = element('div', 'room')
    room.append(element('span', 'room__label', 'Room code'), element('b', 'room__code', code))

    const roomActions = element('div', 'room__actions')
    roomActions.append(
      plainButton(
        'Copy',
        () => {
          void navigator.clipboard
            ?.writeText(code)
            .then(() => showToast(`Room code ${code} copied`))
            .catch(() => showToast('Could not copy — type the code instead'))
        },
        { ghost: true, small: true },
      ),
      plainButton('Copy link', () => copyInvite(code), { ghost: true, small: true }),
      plainButton(
        'New code',
        () => {
          change({ roomCode: createRoomCode() })
        },
        { ghost: true, small: true },
      ),
    )
    room.append(roomActions)
    box.append(room)

    const max = roundCount(settings.playerCount)

    box.append(
      choiceGroup(
        'Players',
        '01',
        [3, 4, 5, 6].map((count) => ({ label: String(count), value: count })),
        settings.playerCount,
        (value) => change({ playerCount: value }),
      ),
      choiceGroup(
        'Rounds',
        '02',
        // Nur Rundenzahlen, die das Deck bei dieser Spielerzahl hergibt --
        // sonst stuende dort eine Zahl, die beim Starten stillschweigend
        // kleiner wuerde. "Alle" ist der Vollausbau bis zur groessten Hand.
        [
          ...[3, 5, 8, 10].filter((value) => value < max).map(numberOption),
          { label: `All (${max})`, value: null as number | null },
        ],
        settings.rounds !== null && settings.rounds < max ? settings.rounds : null,
        (value) => change({ rounds: value }),
      ),
      choiceGroup(
        'Bots',
        '03',
        DIFFICULTIES.map((d) => ({ label: DIFFICULTY_LABEL[d], value: d as Difficulty })),
        settings.difficulty,
        (value) => change({ difficulty: value }),
      ),
    )

    box.append(nameField())

    box.append(
      actionRow([
        // Der Weg mit Freunden: Der Raum geht auf, der Code gilt, und im
        // Wartebildschirm sieht man, wer hereinkommt.
        plainButton('Open room', () => {
          const now = deps.settings()
          if (now.playerName.trim().length === 0) {
            showToast('Enter your name first')
            return
          }
          const open = now.roomCode ?? code
          showInvite(open)
          deps.openRoom({ create: true, code: open })
        }),
        // Der Weg ohne Netz. Er bleibt, weil er der schnellste ist: Wer nur
        // eine Runde gegen Bots will, soll nicht erst einen Server fragen.
        plainButton(
          'Solo vs bots',
          () => {
            const now = deps.settings()
            deps.start(
              friendsMatch({
                playerCount: now.playerCount,
                difficulty: now.difficulty,
                rounds: now.rounds,
                roomCode: now.roomCode ?? code,
              }),
            )
          },
          { ghost: true },
        ),
        plainButton('Back', back, { ghost: true }),
      ]),
      note(
        'Tell your friends the room code — they join via "Play → Join a friend". Bots take any seats that stay empty. This game is unranked and earns no rank points.',
      ),
    )

    return box
  }

  /**
   * Der Anzeigename.
   *
   * Kein Konto, kein Passwort (Entscheidung 2.3) -- nur ein Name, der auf
   * diesem Geraet gemerkt wird. Er steht auf beiden Wegen in den Raum, weil
   * man ihn auf beiden braucht.
   */
  function nameField(): HTMLElement {
    const group = element('div', 'menu__group')

    const caption = element('span', 'menu__label')
    caption.append(element('small', null, '00'), document.createTextNode('Your name'))
    group.append(caption)

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'code__input is-name'
    input.autocomplete = 'off'
    input.maxLength = 16
    input.placeholder = 'What should the others call you?'
    input.value = deps.settings().playerName
    input.setAttribute('aria-label', 'Your name')

    // Bewusst ohne Neuzeichnen: Wer tippt, soll nicht bei jedem Buchstaben
    // den Eingabezeiger verlieren.
    input.addEventListener('input', () => deps.change({ playerName: input.value }))

    group.append(input)
    return group
  }

  /**
   * Beitreten mit fremdem Code.
   *
   * Der Code wird geprueft, und dann ist Schluss: Ohne Server gibt es keinen
   * Raum, in den man kommen koennte. Das steht hier so und wird nicht durch
   * eine Partie gegen Bots verdeckt -- wer einem Freund beitreten will, ist
   * mit Bots nicht bedient.
   */
  function joinScreen(): HTMLElement {
    const box = section('Join a friend')
    box.append(nameField())

    const field = element('div', 'code')
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'code__input'
    input.autocomplete = 'off'
    input.spellcheck = false
    input.maxLength = ROOM_CODE_LENGTH
    input.placeholder = '·'.repeat(ROOM_CODE_LENGTH)
    input.setAttribute('aria-label', 'Room code')

    // Der Eingegebene ueberlebt das Neuzeichnen. Wer sich vertippt hat, soll
    // die eine falsche Stelle aendern und nicht den ganzen Code neu suchen.
    input.value = joinCode
    input.addEventListener('input', () => {
      joinCode = normalizeRoomCode(input.value)
      if (joinCode !== input.value) input.value = joinCode
    })
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') join()
    })

    field.append(input)
    box.append(
      element(
        'p',
        'menu__lead',
        invited === null
          ? 'Your friend creates the room and tells you the code.'
          : "You've been invited — the code is already filled in. Just enter your name.",
      ),
      field,
      actionRow([
        plainButton('Join', join),
        plainButton('Back', back, { ghost: true }),
      ]),
    )

    if (joinNote !== null) {
      box.append(note(joinNote, 'is-warn'))
      box.append(
        actionRow([
          plainButton('Create your own room instead', () => go('create'), { ghost: true }),
        ]),
      )
    }

    queueMicrotask(() => input.focus())
    return box
  }

  function join(): void {
    const code = joinCode

    if (!isRoomCode(code)) {
      joinNote = `A room code has ${ROOM_CODE_LENGTH} characters — you have entered ${plural(code.length, 'character', 'characters')} so far.`
      render()
      return
    }

    if (deps.settings().playerName.trim().length === 0) {
      joinNote = 'Enter your name first — the others should see who just joined.'
      render()
      return
    }

    // Ob es den Raum ueberhaupt gibt, weiss nur der Server. Seine Antwort
    // kommt als Absage zurueck und landet in `roomNote`.
    joinNote = null
    showInvite(code)
    deps.openRoom({ create: false, code })
  }

  /* ---------------------------------------------------------------- *
   * Der Warteraum
   * ---------------------------------------------------------------- */

  /**
   * Wer schon da ist, und was noch fehlt.
   *
   * Derselbe Bildschirm fuer Wirt und Gast -- sie unterscheiden sich in genau
   * einer Zeile: Der Wirt hat einen Startknopf, der Gast einen Hinweis, auf
   * wen gewartet wird. Zwei Bildschirme dafuer waeren zwei Bildschirme, die
   * beim naechsten Umbau auseinanderlaufen.
   */
  function roomScreen(): HTMLElement {
    const box = section('Room')
    const room = deps.room()
    const trouble = deps.roomNote()

    if (trouble !== null) {
      box.append(note(trouble, 'is-warn'))
      box.append(
        actionRow([
          plainButton('Try again', () => go('join'), { ghost: true }),
          plainButton('Create your own room', () => go('create'), { ghost: true }),
          plainButton('Back', back, { ghost: true }),
        ]),
      )
      return box
    }

    if (room === null || room.status() === 'connecting') {
      box.append(element('p', 'menu__lead', 'Connecting to the server …'))
      box.append(backButton())
      return box
    }

    const lobby = room.lobby()
    if (lobby === null) {
      box.append(element('p', 'menu__lead', 'Waiting for the room …'))
      box.append(backButton())
      return box
    }

    const strip = element('div', 'room')
    strip.append(element('span', 'room__label', 'Room code'), element('b', 'room__code', lobby.code))

    const roomActions = element('div', 'room__actions')
    roomActions.append(
      plainButton(
        'Copy',
        () => {
          void navigator.clipboard
            ?.writeText(lobby.code)
            .then(() => showToast(`Room code ${lobby.code} copied`))
            .catch(() => showToast('Could not copy — type the code instead'))
        },
        { ghost: true, small: true },
      ),
      plainButton('Copy link', () => copyInvite(lobby.code), { ghost: true, small: true }),
    )
    strip.append(roomActions)
    box.append(strip)

    const list = element('div', 'seats')
    lobby.seats.forEach((occupant, index) => {
      const row = element('div', 'seats__row')
      const mine = index === room.seat()

      const who =
        occupant.kind === 'human'
          ? mine
            ? `${occupant.name} (you)`
            : occupant.name
          : occupant.kind === 'bot'
            ? `${occupant.name} · Bot`
            : 'open — waiting for someone'

      row.append(element('span', 'seats__seat', `${index + 1}`), element('b', 'seats__who', who))

      if (occupant.kind === 'human' && !occupant.connected) {
        row.append(element('span', 'seats__state', 'disconnected'))
      }
      if (index === lobby.hostSeat) row.append(element('span', 'seats__state', 'Host'))
      if (mine) row.classList.add('is-me')
      if (occupant.kind === 'empty') row.classList.add('is-empty')

      list.append(row)
    })
    box.append(list)

    const humans = lobby.seats.filter((seat) => seat.kind === 'human').length
    const free = lobby.seats.filter((seat) => seat.kind === 'empty').length
    const rounds = lobby.rules.rounds

    box.append(
      note(
        `${humans} in the room, ${plural(free, 'seat', 'seats')} open · ${lobby.seats.length} at the table, ${rounds === null ? 'all rounds' : plural(rounds, 'round', 'rounds')}.`,
      ),
    )

    if (room.isHost()) {
      box.append(
        actionRow([
          plainButton('Start game', () => room.start()),
          plainButton('Leave room', back, { ghost: true }),
        ]),
        note("Bots take the empty seats. Start as soon as everyone's here."),
      )
    } else {
      box.append(
        actionRow([plainButton('Leave room', back, { ghost: true })]),
        note("The host starts the game as soon as everyone's here."),
      )
    }

    return box
  }

  function settingsScreen(): HTMLElement {
    const settings = deps.settings()
    const box = section('Settings')

    box.append(
      choiceGroup(
        'Speed',
        '01',
        SPEED_OPTIONS.map((option) => ({ label: option.label, value: option.ms })),
        settings.speed,
        (value) => change({ speed: value }),
      ),
    )

    const switches = element('div', 'menu__switches')
    switches.append(
      toggle('Bid assist — estimates your hand strength', settings.hint, (on) => change({ hint: on }),
      ),
      toggle('Card counter — shows cards already played', settings.counting, (on) => change({ counting: on }),
      ),
    )

    box.append(switches, actionRow([plainButton('Back', back, { ghost: true })]))
    box.append(
      note('Speed and assists apply immediately, even in a game in progress.'),
    )

    return box
  }

  /**
   * Beenden.
   *
   * Im Browser darf eine Seite sich nur schliessen, wenn sie sich selbst
   * geoeffnet hat -- der Knopf tut dort also nichts, und ein Knopf, der
   * nichts tut, sieht aus wie ein Fehler. Deshalb wird es versucht und
   * anschliessend gesagt, wie es ausging. In der spaeteren Windows-Anwendung
   * schliesst derselbe Knopf das Fenster wirklich.
   */
  function quitScreen(): HTMLElement {
    const box = section('Quit game')

    if (!quitTried) {
      box.append(
        element('p', 'menu__lead', 'Quit Runecall?'),
        actionRow([
          plainButton('Quit', () => {
            quitTried = true
            deps.quit()
            // Ob das Fenster wirklich zugeht, laesst sich nicht abfragen --
            // und wenn es zugeht, liest den Abschied ohnehin niemand mehr.
            render()
          }),
          plainButton('Back', back, { ghost: true }),
        ]),
      )
      return box
    }

    box.append(
      element('p', 'menu__lead', 'See you soon — you can close the tab now.'),
      actionRow([plainButton('Keep playing', () => go('home'), { ghost: true })]),
    )
    return box
  }

  /* ---------------------------------------------------------------- *
   * Bausteine
   * ---------------------------------------------------------------- */

  function rankStrip(): HTMLElement {
    const rank = loadRank()
    const strip = element('div', 'rankstrip')

    strip.append(
      element('span', 'rankstrip__tier', tierOf(rank.points)),
      element('b', 'rankstrip__points', `${rank.points} RP`),
    )

    const next = nextTier(rank.points)
    strip.append(
      element(
        'span',
        'rankstrip__note',
        rank.games === 0
          ? 'no ranked games yet'
          : `${plural(rank.games, 'game', 'games')} · ${plural(rank.wins, 'win', 'wins')}${next === null ? '' : ` · ${next.from - rank.points} to ${next.name}`}`,
      ),
    )

    return strip
  }

  function backButton(): HTMLElement {
    return actionRow([plainButton('Back', back, { ghost: true })])
  }

  /* ---------------------------------------------------------------- *
   * Verdrahtung
   * ---------------------------------------------------------------- */

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    if (!isOpen()) return
    if (screen === 'home') return
    event.preventDefault()
    back()
  })

  return {
    open(next) {
      go(next ?? 'home')
    },
    close() {
      stopTimer()
    },
    screen: () => screen,
    refresh() {
      if (isOpen()) render()
    },
  }
}

/* ------------------------------------------------------------------ *
 * Kleinteile
 * ------------------------------------------------------------------ */

function element(tag: string, className?: string | null, text?: string): HTMLElement {
  const el = document.createElement(tag)
  if (className !== null && className !== undefined) el.className = className
  if (text !== undefined) el.textContent = text
  return el
}

function section(title?: string): HTMLElement {
  const box = element('div', 'menu__stack')
  if (title !== undefined) box.append(element('h2', 'menu__heading', title))
  return box
}

function note(text: string, extra?: string): HTMLElement {
  return element('p', extra === undefined ? 'menu__note' : `menu__note ${extra}`, text)
}

function actionRow(buttons: readonly HTMLElement[]): HTMLElement {
  const row = element('div', 'menu__actions')
  row.append(...buttons)
  return row
}

type ButtonLook = { readonly ghost?: boolean; readonly small?: boolean }

function plainButton(label: string, onClick: () => void, look: ButtonLook = {}): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  if (look.ghost === true) button.classList.add('ghost')
  if (look.small === true) button.classList.add('small')
  button.addEventListener('click', onClick)
  return button
}

/**
 * Ein Knopf mit Unterzeile.
 *
 * Die Hauptwege des Menues sind vier bis fuenf Stueck, und jeder braucht
 * einen Halbsatz dazu -- "Spielen" allein sagt nicht, dass dahinter Fremde
 * und Freunde getrennt liegen.
 */
function bigButton(
  label: string,
  hint: string | null,
  onClick: () => void,
  look: ButtonLook = {},
): HTMLButtonElement {
  const button = plainButton('', onClick, look)
  button.classList.add('bigbtn')
  button.append(element('b', null, label))
  if (hint !== null) button.append(element('small', null, hint))
  return button
}

function toggle(label: string, on: boolean, set: (on: boolean) => void): HTMLElement {
  const row = document.createElement('label')
  row.className = 'switch'

  const box = document.createElement('input')
  box.type = 'checkbox'
  box.checked = on
  box.addEventListener('change', () => set(box.checked))

  row.append(box, element('span', null, label))
  return row
}

const numberOption = (value: number): { label: string; value: number | null } => ({
  label: String(value),
  value,
})

/**
 * Eine Reihe von Auswahlknoepfen, mit Beschriftung davor.
 *
 * Der aktive Knopf traegt `aria-pressed` -- fuer eine Vorlesehilfe ist "Vier,
 * gedrueckt" der Unterschied zwischen einer Liste und einer Auswahl.
 */
function choiceGroup<T>(
  label: string,
  index: string,
  options: readonly { readonly label: string; readonly value: T }[],
  current: T,
  pick: (value: T) => void,
): HTMLElement {
  const group = element('div', 'menu__group')

  const caption = element('span', 'menu__label')
  caption.append(element('small', null, index), document.createTextNode(label))
  group.append(caption)

  const choices = element('div', 'choices')
  for (const option of options) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'pill'
    button.textContent = option.label
    button.setAttribute('aria-pressed', String(option.value === current))
    if (option.value === current) button.classList.add('is-active')
    button.addEventListener('click', () => pick(option.value))
    choices.append(button)
  }

  group.append(choices)
  return group
}

