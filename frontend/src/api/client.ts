import { BASE_URL } from "./config";
import type {
  DailyMetricResponse,
  HourlyMetricResponse,
  ReadingPage,
  StationDetail,
  StationPage,
} from "./types";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}/api${path}`, init);
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function getStation(id: string): Promise<StationDetail> {
  return apiFetch(`/stations/${id}`);
}

export function listStations(page: number, search?: string): Promise<StationPage> {
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set("search", search);
  return apiFetch(`/stations?${params}`);
}

export function getReadings(
  id: string,
  page: number,
  search?: string,
): Promise<ReadingPage> {
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set("search", search);
  return apiFetch(`/stations/${id}/readings?${params}`);
}

export function getHourlyMetric(
  id: string,
  metric: string,
): Promise<HourlyMetricResponse> {
  return apiFetch(`/stations/${id}/metrics/${metric}/hourly`);
}

export function getDailyMetric(
  id: string,
  metric: string,
  days: number,
): Promise<DailyMetricResponse> {
  return apiFetch(`/stations/${id}/metrics/${metric}/daily?days=${days}`);
}
