import { useCallback, useEffect, useState } from "react";
import {
  getDailyMetric,
  getHourlyMetric,
  getReadings,
  getStation,
  listStations,
} from "./client";
import type {
  DailyMetricResponse,
  HourlyMetricResponse,
  ReadingPage,
  StationDetail,
  StationPage,
} from "./types";

type FetchState<T> = { data: T | null; loading: boolean; error: string | null };

const REALTIME_REFRESH_MS = 15_000;

function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[]): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      setState((current) => ({
        data: current.data,
        loading: current.data === null,
        error: null,
      }));
      fetcher().then(
        (data) => {
          if (!cancelled) setState({ data, loading: false, error: null });
        },
        (err: Error) => {
          if (!cancelled) {
            setState((current) => ({
              data: current.data,
              loading: false,
              error: err.message,
            }));
          }
        },
      );
    };

    load();
    const intervalId = window.setInterval(load, REALTIME_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

export function useStation(id: string): FetchState<StationDetail> & { refresh: () => void } {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const state = useFetch(() => getStation(id), [id, tick]);
  return { ...state, refresh };
}

export function useStations(page: number, search: string): FetchState<StationPage> & { refresh: () => void } {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
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
  );
  return { ...state, refresh };
}

export function useHourlyMetric(
  id: string,
  metric: string,
): FetchState<HourlyMetricResponse> {
  return useFetch(() => getHourlyMetric(id, metric), [id, metric]);
}

export function useDailyMetric(
  id: string,
  metric: string,
  days: number,
): FetchState<DailyMetricResponse> {
  return useFetch(() => getDailyMetric(id, metric, days), [id, metric, days]);
}
