/**
 * Runecall-Server -- der Eingang.
 *
 * Der Worker selbst haelt keinen Zustand. Er tut genau zwei Dinge: Er prueft
 * den Raumcode und reicht die Verbindung an das Durable Object weiter, das
 * diesen Code traegt. Alles Weitere passiert dort (room.ts).
 *
 * Warum ein Durable Object je Raum: `idFromName(code)` liefert weltweit
 * dasselbe Objekt fuer denselben Code. Damit sitzen alle Spieler eines Raums
 * garantiert im selben Prozess, ohne dass irgendwo eine Zuordnungstabelle
 * gepflegt werden muesste.
 */

import { CODE_ALPHABET, CODE_LENGTH } from '@runecall/protocol'

export { RoomDO } from './room.ts'

export type Env = {
  readonly ROOMS: DurableObjectNamespace
}

/**
 * Von wo aus der Client sprechen darf.
 *
 * Der Server steht auf einer anderen Adresse als das Spiel (Cloudflare gegen
 * GitHub Pages), also entscheidet CORS mit. Die Liste ist kurz und
 * absichtlich fest: ein `*` waere hier nichts als Bequemlichkeit.
 */
const ALLOWED = [
  'https://milchinien.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]

const isCode = (value: string): boolean =>
  value.length === CODE_LENGTH && [...value].every((ch) => CODE_ALPHABET.includes(ch))

function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin !== null && ALLOWED.includes(origin) ? origin : ALLOWED[0] ?? ''
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Upgrade',
    Vary: 'Origin',
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const cors = corsHeaders(request.headers.get('Origin'))

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    // Ein Lebenszeichen, das sich im Browser aufrufen laesst. Praktisch, um
    // zu sehen, ob der Server ueberhaupt steht, bevor man den Raumcode
    // verdaechtigt.
    if (url.pathname === '/health') {
      return new Response('runecall ok', { headers: { ...cors, 'Content-Type': 'text/plain' } })
    }

    const match = /^\/room\/([^/]+)$/.exec(url.pathname)
    if (match === null) {
      return new Response('Nicht gefunden', { status: 404, headers: cors })
    }

    const code = (match[1] ?? '').toUpperCase()
    if (!isCode(code)) {
      return new Response('Ungueltiger Raumcode', { status: 400, headers: cors })
    }

    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Hier spricht nur WebSocket', { status: 426, headers: cors })
    }

    const room = env.ROOMS.get(env.ROOMS.idFromName(code))
    // Der Code steht nur im Pfad, nicht im Objekt -- ein Durable Object
    // kennt seinen eigenen Namen nicht. Also reichen wir ihn mit.
    return room.fetch(new Request(`https://room/${code}`, request))
  },
}
