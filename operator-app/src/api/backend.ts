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
  const res = await fetch(`${getBackendUrl()}/users`);
  if (!res.ok) throw new Error(`GET /users: ${res.status}`);
  return res.json() as Promise<BackendUser[]>;
}


export async function claimStation(devEui: string, userId: string): Promise<void> {
  const res = await fetch(`${getBackendUrl()}/api/stations/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dev_eui: devEui, user_id: userId }),
  });
  if (!res.ok) throw new Error(`POST /stations/claim: ${res.status}`);
}

export async function deleteUser(userId: string): Promise<void> {
  const res = await fetch(`${getBackendUrl()}/users/${userId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE /users/${userId}: ${res.status}`);
}
