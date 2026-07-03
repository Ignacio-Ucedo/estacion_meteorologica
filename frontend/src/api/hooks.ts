import { useCallback, useEffect, useState } from "react";
import {
  getDailyMetric,
  getHourlyMetric,
  getRecentMetric,
  getReadings,
  getStation,
  listStations,
} from "./client";
import type {
  DailyMetricResponse,
  HourlyMetricResponse,
  RecentMetricResponse,
  ReadingPage,
  StationDetail,
  StationPage,
} from "./types";

type FetchState<T> = { data: T | null; loading: boolean; error: string | null };

function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[], skip = false): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: !skip,
    error: null,
  });

  useEffect(() => {
    if (skip) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    fetcher().then(
      (data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      },
      (err: Error) => {
        if (!cancelled) setState({ data: null, loading: false, error: err.message });
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, skip]);

  return state;
}

const STATION_POLL_MS = 30_000;
const RECENT_POLL_MS = 30_000;
const HOURLY_POLL_MS = 60_000;

export function useStation(id: string): FetchState<StationDetail> & { refresh: () => void } {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const state = useFetch(() => getStation(id), [id, tick], !id);

  useEffect(() => {
    const intervalId = window.setInterval(() => setTick((t) => t + 1), STATION_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  return { ...state, refresh };
}

export function useStations(page: number, search: string): FetchState<StationPage> & { refresh: () => void } {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    const intervalId = window.setInterval(() => setTick((t) => t + 1), STATION_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, []);
  const state = useFetch(() => listStations(page, search || undefined), [page, search, tick]);
  return { ...state, refresh };
}

export function useReadings(
  id: string,
  page: number,
  search: string,
): FetchState<ReadingPage> & { refresh: () => void } {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const state = useFetch(
    () => getReadings(id, page, search || undefined),
    [id, page, search, tick],
    !id,
  );
  return { ...state, refresh };
}

export function useHourlyMetric(
  id: string,
  metric: string,
): FetchState<HourlyMetricResponse> {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const intervalId = window.setInterval(() => setTick((t) => t + 1), HOURLY_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, []);
  return useFetch(() => getHourlyMetric(id, metric), [id, metric, tick], !id);
}

export function useRecentMetric(
  id: string,
  metric: string,
  minutes = 60,
): FetchState<RecentMetricResponse> {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const intervalId = window.setInterval(() => setTick((t) => t + 1), RECENT_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, []);
  return useFetch(() => getRecentMetric(id, metric, minutes), [id, metric, minutes, tick], !id);
}

export function useDailyMetric(
  id: string,
  metric: string,
  days: number,
): FetchState<DailyMetricResponse> {
  return useFetch(() => getDailyMetric(id, metric, days), [id, metric, days], !id);
}
