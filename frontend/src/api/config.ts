export const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";

export const STATION_ID = "alpha";

const STORAGE_KEY = "station-monitor:selected-station";

export function getPersistedStationId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? STATION_ID;
  } catch {
    return STATION_ID;
  }
}

export function persistStationId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // localStorage no disponible (modo privado restrictivo, etc.)
  }
}
