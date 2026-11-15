"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, type InkubatorLog } from "./utils/supabase";

// ─── Fuzzy knowledge ───────────────────────────────────────────────
const RULES = [
  { error: "PB", delta: "PF", heater: "FULL (255)", fan: "OFF (0)",   hColor: "#c0392b", fColor: "#9a8e82" },
  { error: "PB", delta: "Z",  heater: "FULL (255)", fan: "OFF (0)",   hColor: "#c0392b", fColor: "#9a8e82" },
  { error: "PB", delta: "NF", heater: "HIGH (192)", fan: "OFF (0)",   hColor: "#d47c2e", fColor: "#9a8e82" },
  { error: "PM", delta: "PF", heater: "HIGH (192)", fan: "OFF (0)",   hColor: "#d47c2e", fColor: "#9a8e82" },
  { error: "PM", delta: "Z",  heater: "HIGH (192)", fan: "OFF (0)",   hColor: "#d47c2e", fColor: "#9a8e82" },
  { error: "PM", delta: "NF", heater: "LOW (50)",   fan: "HIGH (255)",hColor: "#8b5e3c", fColor: "#2e7d6b" },
  { error: "Z",  delta: "PF", heater: "LOW (50)",   fan: "LOW (80)",  hColor: "#8b5e3c", fColor: "#2e7d6b" },
  { error: "Z",  delta: "Z",  heater: "LOW (50)",   fan: "LOW (80)",  hColor: "#8b5e3c", fColor: "#2e7d6b" },
  { error: "Z",  delta: "NF", heater: "OFF (0)",    fan: "LOW (80)",  hColor: "#9a8e82", fColor: "#2e7d6b" },
  { error: "NM", delta: "PF", heater: "LOW (50)",   fan: "LOW (80)",  hColor: "#8b5e3c", fColor: "#2e7d6b" },
  { error: "NM", delta: "Z",  heater: "OFF (0)",    fan: "HIGH (255)",hColor: "#9a8e82", fColor: "#2e7d6b" },
  { error: "NM", delta: "NF", heater: "OFF (0)",    fan: "HIGH (255)",hColor: "#9a8e82", fColor: "#2e7d6b" },
  { error: "NB", delta: "PF", heater: "OFF (0)",    fan: "HIGH (255)",hColor: "#9a8e82", fColor: "#2e7d6b" },
  { error: "NB", delta: "Z",  heater: "OFF (0)",    fan: "HIGH (255)",hColor: "#9a8e82", fColor: "#2e7d6b" },
  { error: "NB", delta: "NF", heater: "OFF (0)",    fan: "HIGH (255)",hColor: "#9a8e82", fColor: "#2e7d6b" },
];

const ERROR_MF = [
  { label: "NB", name: "Negative Big",    desc: "Suhu jauh LEBIH dari setpoint",  fn: "trapmf(−8, −5, −3, −2)" },
  { label: "NM", name: "Negative Medium", desc: "Suhu agak LEBIH dari setpoint",  fn: "trimf(−3, −1.5, 0)"     },
  { label: "Z",  name: "Zero",            desc: "Suhu TEPAT di setpoint",          fn: "trimf(−1, 0, 1)"        },
  { label: "PM", name: "Positive Medium", desc: "Suhu agak KURANG dari setpoint",  fn: "trimf(0, 1.5, 3)"       },
  { label: "PB", name: "Positive Big",    desc: "Suhu jauh KURANG dari setpoint",  fn: "trapmf(2, 3, 5, 8)"     },
];

const DELTA_MF = [
  { label: "NF", name: "Negative Fast", desc: "Error mengecil — suhu mendekati SP", fn: "trapmf(−3, −1.5, −0.3, 0)" },
  { label: "Z",  name: "Zero",          desc: "Error stabil",                        fn: "trimf(−0.3, 0, 0.3)"       },
  { label: "PF", name: "Positive Fast", desc: "Error membesar — suhu menjauhi SP",   fn: "trapmf(0, 0.3, 1.5, 3)"    },
];

// ─── Helpers ───────────────────────────────────────────────────────
function PwmBar({ value, max = 255, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.06)" }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min((value / max) * 100, 100)}%`, background: color }}
      />
    </div>
  );
}

function StatusPing({ ok }: { ok: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
      {ok && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: "#2e7d6b" }} />}
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: ok ? "#2e7d6b" : "#9a8e82" }} />
    </span>
  );
}

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "fuzzy",     label: "Fuzzy Logic" },
  { key: "riwayat",   label: "Riwayat" },
] as const;
type Tab = typeof TABS[number]["key"];

// ─── Dummy data saat tabel kosong / ESP32 belum nyala ──────────────
function makeDummy(): InkubatorLog[] {
  const now = Date.now();
  return Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    created_at: new Date(now - i * 5000).toISOString(),
    suhu:     +(37.2 + Math.sin(i * 0.5) * 1.2).toFixed(1),
    humidity: +(68 + Math.cos(i * 0.4) * 5).toFixed(1),
    heater:   i % 3 === 0 ? 192 : i % 3 === 1 ? 50 : 0,
    fan:      i % 3 === 0 ? 0   : i % 3 === 1 ? 80 : 255,
    setpoint: 38,
  }));
}

// ─── Riwayat Tab (state sendiri) ───────────────────────────────────
function RiwayatTab() {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate,   setEndDate]   = useState(today);
  const [rows,      setRows]      = useState<InkubatorLog[]>([]);
  const [loading,   setLoading]   = useState(true);

  const fetch50 = useCallback(async (start: string, end: string) => {
    setLoading(true);
    const startISO = new Date(start + "T00:00:00+07:00").toISOString();
    const endISO   = new Date(end   + "T23:59:59+07:00").toISOString();
    const { data } = await supabase
      .from("inkubator_log")
      .select("*")
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .order("created_at", { ascending: false })
      .limit(50);
    setRows(data ?? []);
    setLoading(false);
  }, []);

  // load default on mount
  useEffect(() => { fetch50(today, today); }, [fetch50, today]);

  const temps = rows.map(r => r.suhu).filter(Boolean);
  const hums  = rows.map(r => r.humidity).filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="fade-up">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Riwayat <span style={{ color: "var(--brown)" }}>Data</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Maks 50 data per rentang · default hari ini
        </p>
      </div>

      {/* Date filter */}
      <div className="rounded-3xl p-5 fade-up"
        style={{ background: "var(--card-bg)", border: "1px solid var(--brown-border)" }}>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--muted)" }}>Dari</label>
            <input type="date" value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{ background: "var(--brown-bg)", border: "1px solid var(--brown-border)", color: "var(--foreground)" }} />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--muted)" }}>Sampai</label>
            <input type="date" value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{ background: "var(--brown-bg)", border: "1px solid var(--brown-border)", color: "var(--foreground)" }} />
          </div>
          <button
            onClick={() => fetch50(startDate, endDate)}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #8b5e3c, #c4956a)", boxShadow: "0 2px 10px rgba(139,94,60,0.35)" }}>
            {loading ? "..." : "Tampilkan"}
          </button>
        </div>
      </div>

      {/* Stats */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 fade-up-1">
          {[
            { label: "Suhu Min",  value: temps.length ? `${Math.min(...temps).toFixed(1)}°C` : "-", color: "#2e7d6b" },
            { label: "Suhu Maks", value: temps.length ? `${Math.max(...temps).toFixed(1)}°C` : "-", color: "#c0392b" },
            { label: "Hum Min",   value: hums.length  ? `${Math.min(...hums).toFixed(1)}%`   : "-", color: "#2e7d6b" },
            { label: "Hum Maks",  value: hums.length  ? `${Math.max(...hums).toFixed(1)}%`   : "-", color: "#d47c2e" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4 text-center"
              style={{ background: "var(--card-bg)", border: "1px solid var(--brown-border)" }}>
              <p className="text-xs uppercase tracking-wider" style={{ color: "var(--muted)" }}>{s.label}</p>
              <p className="text-xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="rounded-3xl overflow-hidden fade-up-2"
        style={{ background: "var(--card-bg)", border: "1px solid var(--brown-border)", boxShadow: "0 4px 24px var(--brown-bg)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider"
              style={{ color: "var(--muted)", borderBottom: "1px solid var(--brown-border)", background: "var(--brown-bg)" }}>
              <th className="px-5 py-3">Waktu</th>
              <th className="px-5 py-3">Suhu</th>
              <th className="px-5 py-3">Humidity</th>
              <th className="px-5 py-3">Heater</th>
              <th className="px-5 py-3">Fan</th>
              <th className="px-5 py-3">Setpoint</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="text-center py-12" style={{ color: "var(--muted)" }}>Memuat...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12" style={{ color: "var(--muted)" }}>
                Tidak ada data di rentang tanggal ini.
              </td></tr>
            )}
            {rows.map((l, i) => (
              <tr key={l.id}
                style={{ borderTop: "1px solid rgba(139,94,60,0.07)", background: i % 2 === 1 ? "rgba(139,94,60,0.02)" : undefined }}>
                <td className="px-5 py-3 font-mono text-xs" style={{ color: "var(--muted)" }}>
                  {new Date(l.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour12: false })}
                </td>
                <td className="px-5 py-3 font-semibold" style={{ color: "#c0392b" }}>{l.suhu?.toFixed(1)}°C</td>
                <td className="px-5 py-3 font-semibold" style={{ color: "#2e7d6b" }}>{l.humidity?.toFixed(1)}%</td>
                <td className="px-5 py-3 font-mono">{l.heater}</td>
                <td className="px-5 py-3 font-mono">{l.fan}</td>
                <td className="px-5 py-3 font-mono" style={{ color: "var(--muted)" }}>{l.setpoint}°C</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 0 && (
          <p className="px-5 py-2.5 text-xs" style={{ color: "var(--muted)", borderTop: "1px solid var(--brown-border)" }}>
            Menampilkan {rows.length} data
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────
export default function Home() {
  const [tab, setTab]         = useState<Tab>("dashboard");
  const [logs, setLogs]       = useState<InkubatorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [isDummy, setIsDummy] = useState(false);

  const fetchData = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("inkubator_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (err || !data || data.length === 0) {
      // jangan replace kalau sudah ada data real sebelumnya
      setLogs((prev) => (prev.length && !isDummy ? prev : makeDummy()));
      setIsDummy(true);
      setError(
        err
          ? "Tabel belum dibuat di Supabase — tampil data contoh."
          : "ESP32 belum push data — tampil data contoh."
      );
    } else {
      setLogs(data);
      setIsDummy(false);
      setError(null);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 5000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const latest  = logs[0] ?? null;
  const isOnline = !!latest && Date.now() - new Date(latest.created_at).getTime() < 30_000;

  const SETPOINT   = latest?.setpoint ?? 38;
  const EMERGENCY  = 42;
  const temp       = latest?.suhu      ?? 0;
  const hum        = latest?.humidity  ?? 0;
  const heaterPwm  = latest?.heater    ?? 0;
  const fanPwm     = latest?.fan       ?? 0;
  const error_val  = SETPOINT - temp;

  // derive fuzzy region for active rule highlight
  const eZone = error_val > 2 ? "PB" : error_val > 0 ? "PM" : error_val > -1 ? "Z" : error_val > -3 ? "NM" : "NB";

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>

      {/* ── Nav ──────────────────────────────────────────── */}
      <nav className="w-full max-w-5xl mx-auto px-6 py-5 flex items-center justify-between fade-up">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-lg"
            style={{ background: "linear-gradient(135deg, #8b5e3c, #c4956a)" }}>
            🥚
          </div>
          <div>
            <p className="font-bold text-base leading-tight" style={{ color: "var(--foreground)" }}>Inkubator Telur</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>Fuzzy Logic Control · ESP32</p>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-full" style={{ background: "var(--brown-bg)", border: "1px solid var(--brown-border)" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-250"
              style={{
                background: tab === t.key ? "linear-gradient(135deg, #8b5e3c, #c4956a)" : "transparent",
                color:      tab === t.key ? "#fff" : "var(--muted)",
                boxShadow:  tab === t.key ? "0 2px 10px rgba(139,94,60,0.35)" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 pb-16 space-y-6">

        {/* ── Error banner ─────────────────────────────── */}
        {error && (
          <div className="px-4 py-3 rounded-2xl text-sm flex items-center gap-2"
            style={{ background: "var(--amber-bg)", border: "1px solid rgba(212,124,46,0.25)", color: "var(--amber)" }}>
            <span>⚠️</span>
            <span>{error}{isDummy && " (data contoh)"}</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB: DASHBOARD
        ══════════════════════════════════════════════════ */}
        {tab === "dashboard" && (
          <div className="space-y-5">

            {/* Title + status */}
            <div className="fade-up">
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
                Kondisi <span style={{ color: "var(--brown)" }}>Inkubator</span> Sekarang
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <StatusPing ok={isOnline} />
                <span className="text-sm" style={{ color: "var(--muted)" }}>
                  {loading ? "Menyambungkan..." : isOnline ? "Sensor aktif · update tiap 5 detik" : "Sensor offline atau belum ada data"}
                </span>
              </div>
            </div>

            {/* Emergency banner */}
            {temp >= EMERGENCY && (
              <div className="px-5 py-3 rounded-2xl font-semibold text-sm fade-up"
                style={{ background: "rgba(192,57,43,0.1)", border: "1px solid rgba(192,57,43,0.3)", color: "var(--warm-red)" }}>
                🚨 EMERGENCY — Suhu {temp.toFixed(1)}°C ≥ {EMERGENCY}°C! Heater dimatikan paksa, fan FULL.
              </div>
            )}

            {/* 4 stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 fade-up-1">
              {[
                { label: "Suhu",     value: temp.toFixed(1),    unit: "°C", color: "#c0392b", bg: "var(--warm-red-bg)"  },
                { label: "Humidity", value: hum.toFixed(1),     unit: "%",  color: "#2e7d6b", bg: "var(--teal-bg)"      },
                { label: "Heater",   value: heaterPwm.toString(), unit: "PWM", color: "#d47c2e", bg: "var(--amber-bg)"  },
                { label: "Fan",      value: fanPwm.toString(),    unit: "PWM", color: "#8b5e3c", bg: "var(--brown-bg)"  },
              ].map((c) => (
                <div key={c.label} className="rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5"
                  style={{ background: "var(--card-bg)", border: `1px solid ${c.bg}`, boxShadow: `0 4px 20px ${c.bg}` }}>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{c.label}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: c.color }}>
                    {c.value}<span className="text-sm font-normal ml-1">{c.unit}</span>
                  </p>
                </div>
              ))}
            </div>

            {/* Aktuator detail */}
            <div className="rounded-3xl p-6 fade-up-2"
              style={{ background: "var(--card-bg)", border: "1px solid var(--brown-border)", boxShadow: "0 4px 24px var(--brown-bg)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: "var(--muted)" }}>Aktuator</p>
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
                <div className="flex justify-between text-xs pt-3" style={{ borderTop: "1px solid var(--brown-border)", color: "var(--muted)" }}>
                  <span>Setpoint: <b style={{ color: "var(--foreground)" }}>{SETPOINT}°C</b></span>
                  <span>Error: <b style={{ color: error_val >= 0 ? "#c0392b" : "#2e7d6b" }}>{error_val >= 0 ? "+" : ""}{error_val.toFixed(2)}</b></span>
                  <span>Emergency cutoff: <b style={{ color: "var(--warm-red)" }}>{EMERGENCY}°C</b></span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB: FUZZY LOGIC
        ══════════════════════════════════════════════════ */}
        {tab === "fuzzy" && (
          <div className="space-y-5">

            <div className="fade-up">
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
                Logika <span style={{ color: "var(--brown)" }}>Fuzzy</span> Controller
              </h1>
              <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>Metode Mamdani · Defuzzifikasi Center of Gravity</p>
            </div>

            {/* Alur */}
            <div className="rounded-3xl p-6 fade-up"
              style={{ background: "var(--card-bg)", border: "1px solid var(--brown-border)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--muted)" }}>Alur Kerja</p>
              <div className="flex flex-wrap gap-2 items-center">
                {["DHT22 → Suhu", "Error = SP − T", "Fuzzifikasi", "15 Rules (Mamdani)", "Defuzzifikasi (COG)", "PWM Heater & Fan"].map((s, i, arr) => (
                  <span key={i} className="flex items-center gap-2">
                    <span className="px-3 py-1.5 rounded-xl text-xs font-medium"
                      style={{ background: "var(--brown-bg)", color: "var(--brown)", border: "1px solid var(--brown-border)" }}>
                      {s}
                    </span>
                    {i < arr.length - 1 && <span style={{ color: "var(--muted)" }}>→</span>}
                  </span>
                ))}
              </div>
            </div>

            {/* MF Error */}
            <div className="rounded-3xl overflow-hidden fade-up-1"
              style={{ background: "var(--card-bg)", border: "1px solid var(--brown-border)" }}>
              <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--brown-border)" }}>
                <p className="font-semibold text-sm">Membership Function — Error <span style={{ color: "var(--muted)", fontWeight: 400 }}>(Setpoint − Suhu)</span></p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider" style={{ color: "var(--muted)", borderBottom: "1px solid var(--brown-border)" }}>
                    <th className="px-6 py-3">Label</th>
                    <th className="px-6 py-3">Nama</th>
                    <th className="px-6 py-3">Makna</th>
                    <th className="px-6 py-3 font-mono">Fungsi</th>
                  </tr>
                </thead>
                <tbody>
                  {ERROR_MF.map((r) => (
                    <tr key={r.label} style={{ borderTop: "1px solid rgba(139,94,60,0.07)", background: r.label === eZone ? "var(--brown-bg)" : undefined }}>
                      <td className="px-6 py-3 font-bold" style={{ color: "var(--brown)" }}>{r.label}</td>
                      <td className="px-6 py-3">{r.name}</td>
                      <td className="px-6 py-3 text-xs" style={{ color: "var(--muted)" }}>{r.desc}</td>
                      <td className="px-6 py-3 font-mono text-xs">{r.fn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-6 py-2 text-xs" style={{ color: "var(--muted)", borderTop: "1px solid var(--brown-border)" }}>
                Baris highlight = zona error aktif saat ini
              </p>
            </div>

            {/* MF Delta */}
            <div className="rounded-3xl overflow-hidden fade-up-1"
              style={{ background: "var(--card-bg)", border: "1px solid var(--brown-border)" }}>
              <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--brown-border)" }}>
                <p className="font-semibold text-sm">Membership Function — ΔError <span style={{ color: "var(--muted)", fontWeight: 400 }}>(perubahan error)</span></p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider" style={{ color: "var(--muted)", borderBottom: "1px solid var(--brown-border)" }}>
                    <th className="px-6 py-3">Label</th>
                    <th className="px-6 py-3">Nama</th>
                    <th className="px-6 py-3">Makna</th>
                    <th className="px-6 py-3 font-mono">Fungsi</th>
                  </tr>
                </thead>
                <tbody>
                  {DELTA_MF.map((r) => (
                    <tr key={r.label} style={{ borderTop: "1px solid rgba(139,94,60,0.07)" }}>
                      <td className="px-6 py-3 font-bold" style={{ color: "#2e7d6b" }}>{r.label}</td>
                      <td className="px-6 py-3">{r.name}</td>
                      <td className="px-6 py-3 text-xs" style={{ color: "var(--muted)" }}>{r.desc}</td>
                      <td className="px-6 py-3 font-mono text-xs">{r.fn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Rule base */}
            <div className="rounded-3xl overflow-hidden fade-up-2"
              style={{ background: "var(--card-bg)", border: "1px solid var(--brown-border)" }}>
              <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--brown-border)" }}>
                <p className="font-semibold text-sm">Rule Base — 15 Aturan <span style={{ color: "var(--muted)", fontWeight: 400 }}>IF Error AND ΔError THEN Heater, Fan</span></p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider" style={{ color: "var(--muted)", borderBottom: "1px solid var(--brown-border)" }}>
                      <th className="px-5 py-3">Error</th>
                      <th className="px-5 py-3">ΔError</th>
                      <th className="px-5 py-3">Heater</th>
                      <th className="px-5 py-3">Fan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RULES.map((r, i) => (
                      <tr key={i} style={{ borderTop: "1px solid rgba(139,94,60,0.07)", background: r.error === eZone ? "var(--brown-bg)" : undefined }}>
                        <td className="px-5 py-2.5 font-bold" style={{ color: "var(--brown)" }}>{r.error}</td>
                        <td className="px-5 py-2.5 font-bold" style={{ color: "#2e7d6b" }}>{r.delta}</td>
                        <td className="px-5 py-2.5 font-mono text-xs font-semibold" style={{ color: r.hColor }}>{r.heater}</td>
                        <td className="px-5 py-2.5 font-mono text-xs font-semibold" style={{ color: r.fColor }}>{r.fan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* COG formula + emergency */}
            <div className="grid md:grid-cols-2 gap-4 fade-up-2">
              <div className="rounded-3xl p-6"
                style={{ background: "var(--card-bg)", border: "1px solid var(--brown-border)" }}>
                <p className="font-semibold text-sm mb-3">Defuzzifikasi — COG</p>
                <div className="rounded-xl p-4 font-mono text-xs space-y-1" style={{ background: "var(--brown-bg)" }}>
                  <p style={{ color: "var(--muted)" }}>{`// Center of Gravity`}</p>
                  <p>PWM_heater = Σ(μ · H) / Σ(μ)</p>
                  <p>PWM_fan    = Σ(μ · F) / Σ(μ)</p>
                  <p className="pt-1" style={{ color: "var(--muted)" }}>μ = min(μ_error, μ_delta)</p>
                </div>
              </div>
              <div className="rounded-3xl p-6"
                style={{ background: "rgba(192,57,43,0.05)", border: "1px solid rgba(192,57,43,0.2)" }}>
                <p className="font-semibold text-sm mb-3" style={{ color: "var(--warm-red)" }}>🛑 Emergency Cutoff</p>
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  Jika suhu ≥ <b style={{ color: "var(--warm-red)" }}>42°C</b>, heater langsung
                  PWM = 0 dan fan paksa PWM = 255 — berjalan <b>di luar</b> logika fuzzy
                  sebagai lapisan proteksi keras.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════════════
            TAB: RIWAYAT
        ══════════════════════════════════════════════════ */}
        {tab === "riwayat" && (
          <RiwayatTab />
        )}

      </main>

      <footer className="text-center text-xs py-8" style={{ color: "var(--muted)", borderTop: "1px solid var(--brown-border)" }}>
        Inkubator Telur — Fuzzy Logic Control · Sinyal &amp; Sistem Kontrol Elektronik
      </footer>
    </div>
  );
}
