/**
 * Der Raumcode in der Adresszeile.
 *
 * Einen Code durchsagen geht am Telefon. In einer Nachricht an vier Leute
 * geht ein Link besser: anklicken, Name eintragen, drin. Deshalb steht der
 * Code, sobald man in einem Raum ist, hinter dem Doppelkreuz der Adresse --
 * und wer die Adresse aufruft, landet direkt beim Beitreten.
 *
 * Zwei Formen, ein Ziel:
 *
 *     https://miwale.com/games/runecall/raum/A9YW4   zum Verschicken
 *     https://miwale.com/games/runecall/#A9YW4       woran das Spiel es liest
 *
 * Die schoene Form gibt es nur dort, wo ein Webserver von ihr weiss: miwale
 * schickt sie per Umleitung auf die zweite (`docker/nginx.conf`). Auf GitHub
 * Pages und beim Ausprobieren auf dem eigenen Rechner bleibt es beim
 * Doppelkreuz.
 *
 * Warum nicht ueberall der Pfad: Das Spiel wird mit relativer Basis gebaut
 * (`base: './'` in vite.config.ts), damit dieselben Dateien unter
 * `/games/runecall/` und unter `/Runecall/` liegen koennen. Eine Seite, die
 * unter `/games/runecall/raum/A9YW4` ausgeliefert wird, suchte ihre Skripte
 * dann in `raum/assets/` -- und faende nichts. Die Umleitung raeumt das aus
 * dem Weg, bevor der Browser eine einzige Datei anfragt. Der Teil hinter `#`
 * kommt beim Server ohnehin nie an und wirkt darum ueberall.
 *
 * Wichtig: Das hier ist Bequemlichkeit beim Einladen, kein Ersatz fuer den
 * Server. Den Raum selbst haelt weiterhin nur `packages/server`.
 */

import { isRoomCode, normalizeRoomCode } from './match.ts'

/**
 * Der Code aus der aufgerufenen Adresse -- oder nichts.
 *
 * Alles Ungueltige gilt als nichts: Ein verstuemmelter Link soll den Gast auf
 * dem Startbildschirm abliefern und nicht in einem Raum, den es nie gab.
 */
export function readInviteCode(): string | null {
  try {
    const hash = normalizeRoomCode(decodeURIComponent(window.location.hash.replace(/^#/, '')))
    if (isRoomCode(hash)) return hash

    // Auch die Pfadform lesen: Wo die Umleitung fehlt, aber trotzdem diese
    // Seite ausgeliefert wird, soll der Link nicht ins Leere laufen.
    const fromPath = normalizeRoomCode(/\/raum\/([^/]+)\/?$/.exec(window.location.pathname)?.[1] ?? '')
    return isRoomCode(fromPath) ? fromPath : null
  } catch {
    return null
  }
}

/**
 * Wo die schoene Pfadform ankommt.
 *
 * Eine kurze feste Liste statt einer Einstellung: Es haengt nicht am Bau des
 * Spiels, ob der Pfad funktioniert, sondern an der Umleitung im Webserver
 * dahinter -- und die kennt nur, wer die Adresse kennt.
 */
const PRETTY_HOSTS = ['miwale.com', 'www.miwale.com']

/** Der Ordner, in dem das Spiel liegt -- mit Schraegstrich am Ende. */
function basePath(): string {
  const path = window.location.pathname.replace(/[^/]*$/, '')
  return path.endsWith('/') ? path : `${path}/`
}

/** Die Adresse, die man verschickt. */
export function inviteLink(code: string): string {
  const { origin, hostname, pathname } = window.location
  if (PRETTY_HOSTS.includes(hostname)) return `${origin}${basePath()}raum/${code}`
  return `${origin}${pathname}#${code}`
}

/**
 * Den Code in die Adresse schreiben, ohne einen Verlaufseintrag anzulegen.
 *
 * `replaceState` statt `pushState`: Der Raum ist kein Ort, an den die
 * Zurueck-Taste fuehren soll -- sonst hiesse zurueck, wieder beizutreten.
 */
export function showInvite(code: string): void {
  try {
    window.history.replaceState(null, '', `#${code}`)
  } catch {
    /* Ohne Verlauf geht es auch -- nur ohne Link zum Weitergeben. */
  }
}

/** Nach dem Verlassen gehoert der Code nicht mehr in die Adresse. */
export function clearInvite(): void {
  try {
    window.history.replaceState(null, '', basePath() + window.location.search)
  } catch {
    /* siehe oben */
  }
}
