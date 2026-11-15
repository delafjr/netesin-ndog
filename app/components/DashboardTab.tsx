import type { InkubatorLog } from "../types/inkubator";
import { EMERGENCY_TEMP } from "../constants/fuzzy";
import { StatCard } from "./StatCard";
import { PwmBar } from "./PwmBar";
import { StatusPing } from "./StatusPing";

export function DashboardTab({
  latest,
  loading,
  isOnline,
}: {
  latest: InkubatorLog | null;
  loading: boolean;
  isOnline: boolean;
}) {
  const temp      = latest?.suhu      ?? 0;
  const hum       = latest?.humidity  ?? 0;
  const heaterPwm = latest?.heater    ?? 0;
  const fanPwm    = latest?.fan       ?? 0;
  const setpoint  = latest?.setpoint  ?? 38;
  const errorVal  = setpoint - temp;

  return (
    <div className="space-y-5">
      {/* Title + status */}
      <div className="fade-up">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Kondisi <span style={{ color: "var(--brown)" }}>Inkubator</span> Sekarang
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <StatusPing ok={isOnline} />
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            {loading
              ? "Menyambungkan..."
              : isOnline
                ? "Sensor aktif · update tiap 5 detik"
                : "Sensor offline — menampilkan data terakhir"}
          </span>
        </div>
      </div>

      {/* Emergency banner */}
      {temp >= EMERGENCY_TEMP && (
        <div
          className="px-5 py-3 rounded-2xl font-semibold text-sm fade-up"
          style={{ background: "rgba(192,57,43,0.1)", border: "1px solid rgba(192,57,43,0.3)", color: "var(--warm-red)" }}
        >
          🚨 EMERGENCY — Suhu {temp.toFixed(1)}°C ≥ {EMERGENCY_TEMP}°C! Heater dimatikan paksa, fan FULL.
        </div>
      )}

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 fade-up-1">
        <StatCard label="Suhu"     value={temp.toFixed(1)}      unit="°C"  color="#c0392b" bg="var(--warm-red-bg)" />
        <StatCard label="Humidity" value={hum.toFixed(1)}       unit="%"   color="#2e7d6b" bg="var(--teal-bg)"     />
        <StatCard label="Heater"   value={heaterPwm.toString()} unit="PWM" color="#d47c2e" bg="var(--amber-bg)"    />
        <StatCard label="Fan"      value={fanPwm.toString()}    unit="PWM" color="#8b5e3c" bg="var(--brown-bg)"    />
      </div>

      {/* Aktuator detail */}
      <div
        className="rounded-3xl p-6 fade-up-2"
        style={{ background: "var(--card-bg)", border: "1px solid var(--brown-border)", boxShadow: "0 4px 24px var(--brown-bg)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: "var(--muted)" }}>
          Aktuator
        </p>
        <div className="space-y-5">
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span style={{ color: "var(--foreground)" }}>🔥 Heater</span>
              <span className="font-mono font-bold" style={{ color: "#c0392b" }}>{heaterPwm} / 255</span>
            </div>
            <PwmBar value={heaterPwm} color="#c0392b" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1.5">
              <span style={{ color: "var(--foreground)" }}>💨 Fan</span>
              <span className="font-mono font-bold" style={{ color: "#2e7d6b" }}>{fanPwm} / 255</span>
            </div>
            <PwmBar value={fanPwm} color="#2e7d6b" />
          </div>
          <div
            className="flex justify-between text-xs pt-3"
            style={{ borderTop: "1px solid var(--brown-border)", color: "var(--muted)" }}
          >
            <span>Setpoint: <b style={{ color: "var(--foreground)" }}>{setpoint}°C</b></span>
            <span>
              Error:{" "}
              <b style={{ color: errorVal >= 0 ? "#c0392b" : "#2e7d6b" }}>
                {errorVal >= 0 ? "+" : ""}{errorVal.toFixed(2)}
              </b>
            </span>
            <span>Emergency cutoff: <b style={{ color: "var(--warm-red)" }}>{EMERGENCY_TEMP}°C</b></span>
          </div>
        </div>
      </div>
    </div>
  );
}
