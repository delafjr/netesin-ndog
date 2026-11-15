import type { InkubatorLog } from "../types/inkubator";

export function makeDummy(): InkubatorLog[] {
  const now = Date.now();
  return Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    created_at: new Date(now - i * 5000).toISOString(),
    suhu:     +(37.2 + Math.sin(i * 0.5) * 1.2).toFixed(1),
    humidity: +(68   + Math.cos(i * 0.4) * 5).toFixed(1),
    heater:   i % 3 === 0 ? 192 : i % 3 === 1 ? 50 : 0,
    fan:      i % 3 === 0 ? 0   : i % 3 === 1 ? 80 : 255,
    setpoint: 38,
  }));
}
