/**
 * Der Browserspeicher, an einer Stelle.
 *
 * Drei Dinge liegen dort: die Einstellungen, eine laufende Partie und der
 * Rangstand. Alle drei muessen damit rechnen, dass es den Speicher nicht gibt
 * -- privater Modus, gesperrte Seitendaten, voller Speicher. Nicht speichern
 * zu koennen ist aergerlich, aber kein Grund, das Spiel abzubrechen. Deshalb
 * schluckt jeder Zugriff hier seinen Fehler und faellt auf `null` zurueck.
 */

export function readStore(key: string): unknown {
  try {
    const text = localStorage.getItem(key)
    return text === null ? null : (JSON.parse(text) as unknown)
  } catch {
    return null
  }
}

export function writeStore(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Siehe oben: ohne Speicher wird eben nichts gemerkt.
  }
}

export function clearStore(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Dann bleibt der alte Eintrag stehen; er wird beim Lesen ohnehin geprueft.
  }
}
