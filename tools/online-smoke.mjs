/**
 * Ein Durchlauf durch eine Online-Partie -- ueber das echte Protokoll.
 *
 * Der Test spricht mit dem laufenden Server wie ein Browser: zwei Verbindungen,
 * ein Raumcode, eine Partie bis zum Ende. Er prueft dabei das eine, was online
 * schiefgehen kann, ohne dass man es sieht -- ob ein Client mehr erfaehrt, als
 * ihm zusteht.
 *
 *     node tools/online-smoke.mjs [url]
 *
 * Voraussetzung: `npm run dev --workspace @runecall/server` laeuft.
 */

const BASE = (process.argv[2] ?? 'ws://127.0.0.1:8787').replace(/\/$/, '')
const CODE = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')

const RULES = { playerCount: 3, rounds: 2, difficulty: 'normal' }

let failures = 0
const check = (ok, what) => {
  if (!ok) {
    failures += 1
    console.error(`  FEHLER  ${what}`)
  }
}

/** Ein Spieler am Draht. */
function player(name, create, expectRefusal = false) {
  const ws = new WebSocket(`${BASE}/room/${CODE}`)
  const state = { name, ws, seat: -1, view: null, lobby: null, done: false, names: [], refused: null }

  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ type: 'hello', name, create, ...(create ? { rules: RULES } : {}) }))
  })

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)

    if (msg.type === 'welcome') {
      state.seat = msg.seat
      state.lobby = msg.lobby
      console.log(`  ${name} sitzt auf Platz ${msg.seat}`)
      return
    }
    if (msg.type === 'lobby') {
      state.lobby = msg.lobby
      return
    }
    if (msg.type === 'refused') {
      state.refused = msg.reason
      if (expectRefusal) console.log(`  ${name} wird abgewiesen: ${msg.reason} -- richtig so`)
      else {
        console.error(`  ABGEWIESEN  ${name}: ${msg.reason}`)
        failures += 1
      }
      return
    }
    if (msg.type === 'rejected') {
      console.error(`  ZUG ABGELEHNT  ${name}: ${msg.message}`)
      failures += 1
      return
    }
    if (msg.type !== 'view') return

    const view = msg.view
    state.view = view
    state.names = msg.names

    // Das Wichtigste am ganzen Aufbau: Was hier ankommt, ist die eigene
    // Sicht -- und die kennt genau eine Hand.
    check(view.you === state.seat, `${name}: Sicht gehoert Platz ${view.you}, nicht ${state.seat}`)
    check(Array.isArray(view.hand), `${name}: keine eigene Hand`)
    check(view.hands === undefined, `${name}: der Server hat alle Haende mitgeschickt`)
    check(view.stock === undefined, `${name}: der Server hat den Reststapel mitgeschickt`)
    check(
      view.handSizes.length === RULES.playerCount,
      `${name}: ${view.handSizes.length} Plaetze statt ${RULES.playerCount}`,
    )

    if (view.phase === 'game-over') {
      if (!state.done) {
        state.done = true
        console.log(`  ${name} sieht das Ende: ${view.scores.join(' / ')}`)
      }
      return
    }

    act(state)
  })

  return state
}

/** Ziehen, wenn man dran ist. Immer der einfachste erlaubte Zug. */
function act(state) {
  const view = state.view
  const me = state.seat
  const send = (action) => state.ws.send(JSON.stringify({ type: 'action', action }))

  if (view.phase === 'trump-choice' && view.dealer === me) {
    send({ type: 'choose-trump', suit: 'red' })
    return
  }
  if (view.phase === 'bidding' && view.turn === me) {
    // Null ist in jeder Runde erlaubt.
    send({ type: 'bid', value: 0 })
    return
  }
  if (view.phase === 'playing' && view.turn === me) {
    check(view.playable.length > 0, `${state.name}: am Zug, aber keine Karte erlaubt`)
    const card = view.playable[0]
    if (card !== undefined) send({ type: 'play', cardId: card })
    return
  }
  if (view.phase === 'round-end') {
    // Der niedrigste Platz klickt weiter -- sonst tun es alle gleichzeitig.
    if (me === 0) send({ type: 'next-round' })
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

console.log(`Raum ${CODE} auf ${BASE}`)

const alice = player('Alice', true)
await sleep(600)
const bob = player('Bob', false)
await sleep(800)

console.log(`  Lobby: ${alice.lobby?.seats.map((s) => s.kind).join(', ')}`)
check(alice.seat === 0, 'Alice ist nicht Wirt auf Platz 0')
check(bob.seat === 1, 'Bob sitzt nicht auf Platz 1')
check(alice.lobby?.hostSeat === 0, 'Wirt steht nicht auf Platz 0')

// Ein Dritter darf nicht mehr herein, sobald es losgeht -- aber vorher schon.
console.log('  Alice startet die Partie')
alice.ws.send(JSON.stringify({ type: 'start' }))

// Die Partie laeuft von selbst weiter: Jede Sicht loest den naechsten Zug aus.
for (let i = 0; i < 100 && !(alice.done && bob.done); i += 1) await sleep(100)

check(alice.done, 'Alice hat das Partieende nicht gesehen')
check(bob.done, 'Bob hat das Partieende nicht gesehen')
check(
  JSON.stringify(alice.view?.scores) === JSON.stringify(bob.view?.scores),
  'Die beiden sehen verschiedene Punktstaende',
)

// Der dritte Platz gehoert einem Bot, und der hat einen Namen.
console.log(`  Namen: ${alice.names.join(', ')}`)

// Wer jetzt noch anklopft, kommt nicht mehr herein.
const late = player('Carl', false, true)
await sleep(700)
check(late.seat === -1, 'Ein Nachzuegler kam in die laufende Partie')
check(late.refused === 'already-started', `Nachzuegler bekam "${late.refused}" statt "already-started"`)

for (const p of [alice, bob, late]) p.ws.close()

console.log(failures === 0 ? '\nBestanden.' : `\n${failures} Fehler.`)
process.exit(failures === 0 ? 0 : 1)
