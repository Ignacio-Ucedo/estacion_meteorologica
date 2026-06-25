export type WeatherPoint = {
  hour: number; // 0–24
  label: string; // "00:00"
  temperature: number; // °C
  humidity: number; // %
  windSpeed: number; // km/h
  precipitation: number; // mm, accumulated in that hour
};

function formatHour(hour: number) {
  const h = hour % 24;
  return `${h.toString().padStart(2, "0")}:00`;
}

// Genera una serie horaria 0–24 con curvas plausibles para un dia templado
// con lluvia breve a la tarde, para alimentar las cuatro graficas.
export const weatherSeries: WeatherPoint[] = Array.from({ length: 25 }, (_, hour) => {
  // Temperatura: minimo de madrugada, pico a media tarde
  const temperature = 13 + 11 * Math.sin(((hour - 6) / 24) * Math.PI * 2 * -1 + Math.PI / 2.4);

  // Humedad: inversa a la temperatura, mas alta de madrugada
  const humidity = 68 - 22 * Math.sin(((hour - 6) / 24) * Math.PI * 2 * -1 + Math.PI / 2.4);

  // Viento: sube durante la tarde, con algo de ruido
  const windBase = 8 + 14 * Math.max(0, Math.sin(((hour - 9) / 14) * Math.PI));
  const windNoise = Math.sin(hour * 1.7) * 2.5;
  const windSpeed = Math.max(0, windBase + windNoise);

  // Precipitacion: una racha de lluvia entre las 15 y 19hs
  let precipitation = 0;
  if (hour >= 15 && hour <= 19) {
    const t = (hour - 15) / 4;
    precipitation = Math.max(0, Math.sin(t * Math.PI) * 6.5);
  }

  return {
    hour,
    label: formatHour(hour),
    temperature: Math.round(temperature * 10) / 10,
    humidity: Math.round(Math.max(0, Math.min(100, humidity))),
    windSpeed: Math.round(windSpeed * 10) / 10,
    precipitation: Math.round(precipitation * 10) / 10,
  };
});