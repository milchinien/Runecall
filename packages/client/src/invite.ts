/**
 * Der Raumcode in der Adresszeile.
 *
 * Einen Code durchsagen geht am Telefon. In einer Nachricht an vier Leute
 * geht ein Link besser: anklicken, Name eintragen, drin. Deshalb steht der
 * Code, sobald man in einem Raum ist, hinter dem Doppelkreuz der Adresse --
 * und wer die Adresse aufruft, landet direkt beim Beitreten.
 *
 * Warum das Doppelkreuz und kein Pfad wie `/raum/A9YW4`: Das Spiel liegt als
 * Haufen fertiger Dateien auf einem Webserver, der nichts weiter tut, als sie
 * herauszugeben. Ein Pfad, den es als Datei nicht gibt, waere dort ein 404 --
 * es sei denn, man traegt dem Server eine Umschreibung ein, und die gilt dann
 * nur fuer die eine Adresse. Der Teil hinter `#` kommt beim Server gar nicht
 * erst an, funktioniert also ueberall gleich: auf miwale.com, auf GitHub
 * Pages und beim Ausprobieren auf dem eigenen Rechner.
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
    const raw = window.location.hash.replace(/^#/, '')
    const code = normalizeRoomCode(decodeURIComponent(raw))
    return isRoomCode(code) ? code : null
  } catch {
    return null
  }
}

/** Die Adresse, die man verschickt. */
export function inviteLink(code: string): string {
  const { origin, pathname } = window.location
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
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  } catch {
    /* siehe oben */
  }
}
