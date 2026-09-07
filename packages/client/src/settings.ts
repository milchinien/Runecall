/**
 * Einstellungen und gespeicherter Spielstand.
 *
 * Beides liegt im Browserspeicher des Geraets (siehe store.ts). Eine laufende
 * Partie wird nach jedem Zug gesichert und laesst sich fortsetzen
 * (Entscheidung 28) -- der Spielzustand der Engine ist reine Datenstruktur,
 * also genuegt dafuer JSON.
 *
 * Die Einstellungen halten zweierlei: was ueberall gilt (Tempo, Hilfen) und
 * was zuletzt im eigenen Raum stand (Spielerzahl, Gegner, Rundenzahl, Code).
 * Der Raum merkt sich damit seine Form -- wer immer zu fuenft ueber zehn
 * Runden spielt, stellt das nicht jedes Mal neu ein. Der feste Regelsatz der
 * gewerteten Partie steht dagegen in match.ts und ist nicht einstellbar.
 */

import type { GameState } from '@runecall/engine'
import type { Difficulty } from '@runecall/bots'

import { createRoomCode, type MatchConfig } from './match.ts'
import { clearStore, readStore, writeStore } from './store.ts'

export type Settings = {
  readonly playerCount: number
  readonly difficulty: Difficulty
  /** Rundenzahl im eigenen Raum; `null` heisst: so viele wie moeglich. */
  readonly rounds: number | null
  /** Der Code des eigenen Raums, damit er ueber Sitzungen hinweg gleich bleibt. */
  readonly roomCode: string | null
  /** Wartezeit je Bot-Zug in Millisekunden (Frage 16). */
  readonly speed: number
  /** Zeigt, welche Karten in dieser Runde schon gefallen sind (Frage 15). */
  readonly counting: boolean
  /** Schaetzt die eigene Handstaerke vor der Ansage ein (Frage 18). */
  readonly hint: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  playerCount: 4,
  difficulty: 'normal',
  rounds: null,
  roomCode: null,
  speed: 1000,
  counting: false,
  hint: true,
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Leicht',
  normal: 'Normal',
  hard: 'Schwer',
}

/**
 * Wie lange ein Mitspieler ueberlegt, bevor er legt.
 *
 * Die Zeiten sind bewusst reichlich: Ein Bot koennte sofort antworten, aber
 * dann sieht man nicht mehr, *wer* was gelegt hat -- der Stich ist vorbei,
 * bevor man ihn gelesen hat. Dazu kommt die Bewegung der Karte selbst, die
 * noch einmal gut eine Drittelsekunde dauert.
 */
export const SPEED_OPTIONS: readonly { readonly label: string; readonly ms: number }[] = [
  { label: 'Ruhig', ms: 1600 },
  { label: 'Normal', ms: 1000 },
  { label: 'Zügig', ms: 550 },
]

/**
 * Frueher waren dieselben drei Stufen schneller eingestellt.
 *
 * Wer damals gespielt hat, hat einen dieser Werte im Browserspeicher stehen
 * und bekaeme sonst weiter das alte Tempo -- ein geaenderter Standard gilt
 * nur fuer den, der noch nichts gespeichert hat. Uebersetzt wird deshalb die
 * Stufe, nicht der Wert.
 */
const LEGACY_SPEED: Readonly<Record<number, number>> = { 1100: 1600, 600: 1000, 260: 550 }

/* ------------------------------------------------------------------ *
 * Speicher
 * ------------------------------------------------------------------ */

const SETTINGS_KEY = 'runecall.settings.v1'
const SAVE_KEY = 'runecall.save.v1'

export type SavedGame = {
  readonly state: GameState
  readonly settings: Settings
  readonly seed: number
  /** Wie diese Partie zustande kam -- entscheidet ueber die Wertung. */
  readonly match: MatchConfig
}

/** Liest gespeicherte Werte; bei kaputtem oder fehlendem Eintrag den Standard. */
export function loadSettings(): Settings {
  const raw = readStore(SETTINGS_KEY)
  const saved = { ...DEFAULT_SETTINGS, ...((raw ?? {}) as Partial<Settings>) }

  const settings: Settings = {
    ...saved,
    speed: LEGACY_SPEED[saved.speed] ?? saved.speed,
    roomCode: saved.roomCode ?? createRoomCode(),
  }

  // Ein neu gewuerfelter Raumcode wird sofort festgeschrieben. Sonst haette
  // der eigene Raum nach jedem Neuladen einen anderen Code -- und ein Code,
  // den man gerade jemandem durchgesagt hat, waere damit hinfaellig.
  if (saved.roomCode !== settings.roomCode) saveSettings(settings)

  return settings
}

export function saveSettings(settings: Settings): void {
  writeStore(SETTINGS_KEY, settings)
}

export function loadGame(): SavedGame | null {
  const raw = readStore(SAVE_KEY)
  if (raw === null) return null

  const saved = raw as Partial<SavedGame>
  if (saved.state === undefined || saved.settings === undefined) return null
  if (saved.state.phase === 'game-over') return null

  return {
    state: saved.state,
    settings: saved.settings,
    seed: saved.seed ?? 0,
    // Ein Stand aus der Zeit vor den Spielmodi kennt seinen Modus nicht. Er
    // gilt als Partie im eigenen Raum: nicht gewertet. Andersherum -- eine
    // alte Partie nachtraeglich als gewertet zu behandeln -- vergaebe
    // Rangpunkte fuer eine Partie, die nie eine Ranked-Partie war.
    match: saved.match ?? {
      mode: 'friends',
      playerCount: saved.state.playerCount,
      totalRounds: saved.state.totalRounds,
      difficulty: saved.settings.difficulty,
      roomCode: null,
    },
  }
}

export function saveGame(game: SavedGame): void {
  writeStore(SAVE_KEY, game)
}

export function clearGame(): void {
  clearStore(SAVE_KEY)
}
