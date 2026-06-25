export type StationDef = {
  id: string;
  name: string;
  baseTemp: number; // centro de la oscilacion termica de esa estacion
  baseHumidity: number;
  baseWind: number;
  rainProne: boolean; // si esta estacion suele registrar precipitacion
};

export type StationReading = {
  id: string; // id unico de la lectura (para keys de animacion)
  stationId: string;
  stationName: string;
  timestamp: Date;
  temperature: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
};

export const stations: StationDef[] = [
  { id: "alpha", name: "Alpha Base Station", baseTemp: 22, baseHumidity: 45, baseWind: 13, rainProne: false },
  { id: "beta", name: "Beta Ridge Anemometer", baseTemp: 30, baseHumidity: 28, baseWind: 44, rainProne: false },
  { id: "gamma", name: "Gamma Valley Array", baseTemp: 18, baseHumidity: 86, baseWind: 5, rainProne: true },
  { id: "delta", name: "Delta Peak Sensor", baseTemp: -4, baseHumidity: 90, baseWind: 60, rainProne: false },
  { id: "epsilon", name: "Epsilon Coastal Buoy", baseTemp: 19, baseHumidity: 78, baseWind: 22, rainProne: true },
  { id: "zeta", name: "Zeta Desert Outpost", baseTemp: 34, baseHumidity: 12, baseWind: 9, rainProne: false },
];

function jitter(base: number, amount: number) {
  return base + (Math.random() * 2 - 1) * amount;
}

let readingCounter = 0;

// Genera una lectura nueva y plausible para una estacion al azar,
// con timestamp actual, simulando una transmision en vivo.
export function generateReading(at: Date = new Date()): StationReading {
  const station = stations[Math.floor(Math.random() * stations.length)];
  readingCounter += 1;

  const temperature = Math.round(jitter(station.baseTemp, 2.2) * 10) / 10;
  const humidity = Math.round(
    Math.max(0, Math.min(100, jitter(station.baseHumidity, 6))),
  );
  const windSpeed = Math.round(Math.max(0, jitter(station.baseWind, 5)) * 10) / 10;
  const precipitation = station.rainProne && Math.random() < 0.3
    ? Math.round(Math.random() * 14 * 10) / 10
    : 0;

  return {
    id: `${at.getTime()}-${readingCounter}`,
    stationId: station.id,
    stationName: station.name,
    timestamp: at,
    temperature,
    humidity,
    windSpeed,
    precipitation,
  };
}

export function formatTimestamp(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}