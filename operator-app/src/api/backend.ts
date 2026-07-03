export const BACKEND_URL_KEY = "backend_url";

export const BACKEND_PRESETS = [
  { label: "Producción", url: "https://estacion-meteorologica-nnsz.onrender.com" },
  { label: "Local", url: "http://localhost:8000" },
] as const;

export function getBackendUrl(): string {
  try {
    return localStorage.getItem(BACKEND_URL_KEY) ?? BACKEND_PRESETS[0].url;
  } catch {
    return BACKEND_PRESETS[0].url;
  }
}

export interface BackendUser {
  id: string;
  username: string;
  created_at: string;
}

export async function fetchUsers(): Promise<BackendUser[]> {
  const res = await fetch(`${getBackendUrl()}/auth/users`);
  if (!res.ok) throw new Error(`GET /auth/users: ${res.status}`);
  return res.json() as Promise<BackendUser[]>;
}

export interface StationPayload {
  name: string;
  location: string;
  status: "online" | "offline" | "degraded";
  user_id: string | null;
}

export async function createStation(payload: StationPayload): Promise<void> {
  const res = await fetch(`${getBackendUrl()}/api/stations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`POST /stations: ${res.status}`);
  }
}

export async function claimStation(stationId: string, userId: string): Promise<void> {
  const res = await fetch(`${getBackendUrl()}/api/stations/${stationId}/owner`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) throw new Error(`PATCH /stations/${stationId}/owner: ${res.status}`);
}
