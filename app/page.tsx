"use client";

import { useEffect, useState, useCallback } from "react";
import type { InkubatorLog } from "./lib/supabase";

/* ── helpers ─────────────────────────────────────── */
function Gauge({
  label,
  value,
  max,
  unit,
  color,
}: {
  label: string;
  value: number;
  max: number;
  unit: string;
  color: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span className="text-[var(--muted)]">{label}</span>
        <span className="font-mono font-bold" style={{ color }}>
          {value.toFixed(1)}
          {unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--card-border)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? "bg-[var(--accent-green)] animate-pulse" : "bg-[var(--accent-red)]"}`}
    />
  );
}

/* ── fuzzy knowledge tables ──────────────────────── */

const MEMBERSHIP_ERROR = [
  ["NB", "Negative Big", "Suhu jauh di atas setpoint", "trapmf(-8, -5, -3, -2)"],
  ["NM", "Negative Medium", "Suhu agak di atas setpoint", "trimf(-3, -1.5, 0)"],
  ["Z", "Zero", "Suhu tepat di setpoint", "trimf(-1, 0, 1)"],
  ["PM", "Positive Medium", "Suhu agak di bawah setpoint", "trimf(0, 1.5, 3)"],
  ["PB", "Positive Big", "Suhu jauh di bawah setpoint", "trapmf(2, 3, 5, 8)"],
];

const MEMBERSHIP_DELTA = [
  ["NF", "Negative Fast", "Error mengecil (suhu mendekati/melewati SP)", "trapmf(-3, -1.5, -0.3, 0)"],
  ["Z", "Zero", "Error stabil", "trimf(-0.3, 0, 0.3)"],
  ["PF", "Positive Fast", "Error membesar (suhu menjauhi SP)", "trapmf(0, 0.3, 1.5, 3)"],
];

const RULE_TABLE = [
  ["", "NF", "Z", "PF"],
  ["PB", "H3 F0", "H4 F0", "H4 F0"],
  ["PM", "H1 F2", "H3 F0", "H3 F0"],
  ["Z", "H0 F1", "H1 F1", "H1 F1"],
  ["NM", "H0 F2", "H0 F2", "H1 F1"],
  ["NB", "H0 F2", "H0 F2", "H0 F2"],
];

const PWM_MAP = [
  ["Heater Level", "0=OFF (0)", "1=LOW (50)", "2=MED (128)", "3=HIGH (192)", "4=FULL (255)"],
  ["Fan Level", "0=OFF (0)", "1=LOW (80)", "2=HIGH (255)", "", ""],
];

/* ── main page ───────────────────────────────────── */

export default function Home() {
  const [latest, setLatest] = useState<InkubatorLog | null>(null);
  const [logs, setLogs] = useState<InkubatorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"dashboard" | "fuzzy" | "firmware">("dashboard");

  const load = useCallback(async () => {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const h = { apikey: key, Authorization: `Bearer ${key}` };

      const [latestRes, logsRes] = await Promise.all([
        fetch(`${url}/rest/v1/inkubator_log?order=created_at.desc&limit=1`, {
          headers: h,
          cache: "no-store",
        }),
        fetch(`${url}/rest/v1/inkubator_log?order=created_at.desc&limit=50`, {
          headers: h,
          cache: "no-store",
        }),
      ]);

      if (latestRes.ok) {
        const d = await latestRes.json();
        setLatest(d[0] ?? null);
      }
      if (logsRes.ok) {
        setLogs(await logsRes.json());
      }
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Fetch error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [load]);

  const isOnline =
    !!latest &&
    Date.now() - new Date(latest.created_at).getTime() < 30_000;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
      {/* Header */}
      <header className="flex items-center gap-3">
        <span className="text-3xl">🐣</span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Inkubator Telur — Fuzzy Logic
          </h1>
          <p className="text-sm text-[var(--muted)]">
            ESP32 · DHT22 · MX1508 · Mamdani Inference
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <StatusDot ok={isOnline} />
          <span className="text-[var(--muted)]">
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex gap-1 bg-[var(--card)] rounded-lg p-1 w-fit">
        {(["dashboard", "fuzzy", "firmware"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t
                ? "bg-[var(--accent)] text-[var(--background)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {t === "dashboard"
              ? "📊 Dashboard"
              : t === "fuzzy"
                ? "🧠 Fuzzy Logic"
                : "⚡ Firmware"}
          </button>
        ))}
      </nav>

      {loading && (
        <div className="text-center py-20 text-[var(--muted)]">
          Memuat data...
        </div>
      )}
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* ── DASHBOARD ──────────────────────────── */}
      {tab === "dashboard" && !loading && (
        <>
          {/* Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Suhu",
                val: latest?.suhu ?? 0,
                unit: "°C",
                color: "var(--accent-red)",
              },
              {
                label: "Humidity",
                val: latest?.humidity ?? 0,
                unit: "%",
                color: "var(--accent-blue)",
              },
              {
                label: "Heater PWM",
                val: latest?.heater ?? 0,
                unit: "",
                color: "var(--accent)",
              },
              {
                label: "Fan PWM",
                val: latest?.fan ?? 0,
                unit: "",
                color: "var(--accent-green)",
              },
            ].map((c) => (
              <div
                key={c.label}
                className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-4"
              >
                <p className="text-xs text-[var(--muted)] mb-1">{c.label}</p>
                <p
                  className="text-2xl font-bold font-mono"
                  style={{ color: c.color }}
                >
                  {c.val.toFixed(1)}
                  <span className="text-sm font-normal ml-0.5">{c.unit}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Gauges */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5 flex flex-col gap-4">
            <h2 className="font-semibold text-sm text-[var(--muted)] uppercase tracking-wider">
              Aktuator
            </h2>
            <Gauge
              label="Heater"
              value={latest?.heater ?? 0}
              max={255}
              unit=""
              color="var(--accent)"
            />
            <Gauge
              label="Fan"
              value={latest?.fan ?? 0}
              max={255}
              unit=""
              color="var(--accent-blue)"
            />
            <div className="flex justify-between text-xs text-[var(--muted)] pt-2 border-t border-[var(--card-border)]">
              <span>
                Setpoint: <b className="text-[var(--foreground)]">{latest?.setpoint ?? 38}°C</b>
              </span>
              <span>
                Emergency cutoff: <b className="text-[var(--accent-red)]">42°C</b>
              </span>
            </div>
          </div>

          {/* Log table */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--card-border)]">
              <h2 className="font-semibold text-sm text-[var(--muted)] uppercase tracking-wider">
                Riwayat Data (50 terakhir)
              </h2>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--card)]">
                  <tr className="text-left text-[var(--muted)] text-xs uppercase">
                    <th className="px-4 py-2">Waktu</th>
                    <th className="px-4 py-2">Suhu</th>
                    <th className="px-4 py-2">Humidity</th>
                    <th className="px-4 py-2">Heater</th>
                    <th className="px-4 py-2">Fan</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr
                      key={l.id}
                      className="border-t border-[var(--card-border)] hover:bg-white/5"
                    >
                      <td className="px-4 py-2 font-mono text-xs text-[var(--muted)]">
                        {new Date(l.created_at).toLocaleTimeString("id-ID")}
                      </td>
                      <td className="px-4 py-2 font-mono">
                        {l.suhu.toFixed(1)}°C
                      </td>
                      <td className="px-4 py-2 font-mono">
                        {l.humidity.toFixed(0)}%
                      </td>
                      <td className="px-4 py-2 font-mono">{l.heater}</td>
                      <td className="px-4 py-2 font-mono">{l.fan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logs.length === 0 && (
                <p className="text-center text-[var(--muted)] py-8 text-sm">
                  Belum ada data. Pastikan ESP32 sudah push ke Supabase.
                </p>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── FUZZY LOGIC KNOWLEDGE ─────────────── */}
      {tab === "fuzzy" && (
        <div className="flex flex-col gap-6">
          {/* Diagram alir */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
            <h2 className="font-semibold mb-3">📐 Alur Fuzzy Logic Controller</h2>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-mono">
              {["DHT22 → Suhu", "→ Error = SP − Suhu", "→ Fuzzifikasi", "→ Inferensi (15 Rules)", "→ Defuzzifikasi (COG)", "→ PWM Heater & Fan"].map(
                (s, i) => (
                  <span
                    key={i}
                    className="bg-[var(--background)] px-3 py-1.5 rounded-lg border border-[var(--card-border)] text-xs"
                  >
                    {s}
                  </span>
                )
              )}
            </div>
          </div>

          {/* Membership Error */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--card-border)]">
              <h2 className="font-semibold text-sm">
                📊 Membership Function — Error (Setpoint − Suhu)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--muted)] text-xs uppercase">
                    <th className="px-4 py-2">Label</th>
                    <th className="px-4 py-2">Nama</th>
                    <th className="px-4 py-2">Arti</th>
                    <th className="px-4 py-2 font-mono">Parameter</th>
                  </tr>
                </thead>
                <tbody>
                  {MEMBERSHIP_ERROR.map(([label, name, desc, param]) => (
                    <tr
                      key={label}
                      className="border-t border-[var(--card-border)]"
                    >
                      <td className="px-4 py-2 font-bold text-[var(--accent)]">
                        {label}
                      </td>
                      <td className="px-4 py-2">{name}</td>
                      <td className="px-4 py-2 text-[var(--muted)]">{desc}</td>
                      <td className="px-4 py-2 font-mono text-xs">{param}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Membership Delta */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--card-border)]">
              <h2 className="font-semibold text-sm">
                📊 Membership Function — Delta Error (ΔError)
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--muted)] text-xs uppercase">
                    <th className="px-4 py-2">Label</th>
                    <th className="px-4 py-2">Nama</th>
                    <th className="px-4 py-2">Arti</th>
                    <th className="px-4 py-2 font-mono">Parameter</th>
                  </tr>
                </thead>
                <tbody>
                  {MEMBERSHIP_DELTA.map(([label, name, desc, param]) => (
                    <tr
                      key={label}
                      className="border-t border-[var(--card-border)]"
                    >
                      <td className="px-4 py-2 font-bold text-[var(--accent-blue)]">
                        {label}
                      </td>
                      <td className="px-4 py-2">{name}</td>
                      <td className="px-4 py-2 text-[var(--muted)]">{desc}</td>
                      <td className="px-4 py-2 font-mono text-xs">{param}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rule Base Table */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--card-border)]">
              <h2 className="font-semibold text-sm">
                📋 Rule Base — 15 Aturan Fuzzy (Mamdani)
              </h2>
              <p className="text-xs text-[var(--muted)] mt-1">
                Baris = Error, Kolom = ΔError. H = Heater level, F = Fan level.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-center">
                <thead>
                  <tr>
                    {RULE_TABLE[0].map((h, i) => (
                      <th
                        key={i}
                        className="px-4 py-2 text-[var(--muted)] text-xs uppercase font-bold"
                      >
                        {h || "Error \\ ΔErr"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RULE_TABLE.slice(1).map((row, ri) => (
                    <tr
                      key={ri}
                      className="border-t border-[var(--card-border)]"
                    >
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className={`px-4 py-2 font-mono text-xs ${ci === 0 ? "font-bold text-[var(--accent)]" : ""}`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* PWM Mapping */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[var(--card-border)]">
              <h2 className="font-semibold text-sm">🔧 PWM Level Mapping</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {PWM_MAP.map((row, ri) => (
                    <tr
                      key={ri}
                      className="border-t border-[var(--card-border)]"
                    >
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className={`px-4 py-2 ${ci === 0 ? "font-bold text-[var(--accent)]" : "font-mono text-xs"}`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Defuzzifikasi */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl p-5">
            <h2 className="font-semibold mb-2">⚙️ Defuzzifikasi — Center of Gravity</h2>
            <div className="bg-[var(--background)] rounded-lg p-4 font-mono text-xs leading-relaxed">
              <p className="text-[var(--accent)]">{'// Mamdani + COG'}</p>
              <p>PWM_heater = Σ(μ × PWM_level) / Σ(μ)</p>
              <p>PWM_fan = Σ(μ × PWM_level) / Σ(μ)</p>
              <p className="mt-2 text-[var(--muted)]">
                μ = min(μ_error, μ_delta) untuk setiap rule yang aktif
              </p>
            </div>
          </div>

          {/* Safety */}
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-5">
            <h2 className="font-semibold mb-2 text-[var(--accent-red)]">
              🛑 Emergency Cutoff
            </h2>
            <p className="text-sm text-[var(--muted)]">
              Jika suhu ≥ <b className="text-[var(--accent-red)]">42°C</b>,
              heater langsung dimatikan (PWM = 0) dan fan dipaksa maksimal (PWM
              = 255). Proteksi ini berjalan <b>di luar</b> logika fuzzy sebagai
              hard safety layer.
            </p>
          </div>
        </div>
      )}

      {/* ── FIRMWARE CODE ─────────────────────── */}
      {tab === "firmware" && (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--card-border)] flex items-center justify-between">
            <h2 className="font-semibold text-sm">
              inkubator_fuzzy.py — ESP32 MicroPython
            </h2>
            <span className="text-xs text-[var(--muted)] bg-[var(--background)] px-2 py-0.5 rounded">
              MicroPython
            </span>
          </div>
          <pre className="p-4 overflow-x-auto text-xs leading-relaxed font-mono max-h-[70vh] overflow-y-auto">
            <code>{FIRMWARE_CODE}</code>
          </pre>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center text-xs text-[var(--muted)] py-4 border-t border-[var(--card-border)]">
        Inkubator Telur — Fuzzy Logic Control System · Sinyal dan Sistem Kontrol
        Elektronik
      </footer>
    </main>
  );
}

/* ── firmware source embed ──────────────────────── */
const FIRMWARE_CODE = `# inkubator_fuzzy.py
# Target: ESP32 + DHT22 (Pin 4) + Motor Driver MX1508
# Pin 14 → IN1 (Heater PWM), Pin 5 → IN3 (Fan PWM)
# LCD I2C: SDA=21, SCL=22

from machine import Pin, PWM, SoftI2C
import network, urequests, ujson, dht, time

SETPOINT         = 38.0
EMERGENCY_T      = 42.0
DHT_PIN          = 4
HEATER_PIN       = 14
FAN_PIN          = 5
SDA_PIN          = 21
SCL_PIN          = 22
PWM_FREQ         = 1000
LOOP_DELAY_MS    = 2000
PUSH_INTERVAL_MS = 5_000
PUSH_DELTA_T     = 0.3

SUPABASE_URL = "..."   # ← di .env
SUPABASE_KEY = "..."   # ← di .env
WIFI_SSID    = "Mawar1"
WIFI_PASS    = "mawar119"

sensor = dht.DHT22(Pin(DHT_PIN))
heater = PWM(Pin(HEATER_PIN), freq=PWM_FREQ)
fan    = PWM(Pin(FAN_PIN),    freq=PWM_FREQ)

def trimf(x, a, b, c):
    if x <= a or x >= c: return 0.0
    if x == b: return 1.0
    return (x - a) / (b - a) if x < b else (c - x) / (c - b)

def trapmf(x, a, b, c, d):
    if x <= a or x >= d: return 0.0
    if b <= x <= c: return 1.0
    return (x - a) / (b - a) if x < b else (d - x) / (d - c)

def fuzz_error(error):
    return {
        "NB": trapmf(error, -8, -5, -3, -2),
        "NM": trimf(error, -3, -1.5, 0),
        "Z":  trimf(error, -1, 0, 1),
        "PM": trimf(error, 0, 1.5, 3),
        "PB": trapmf(error, 2, 3, 5, 8),
    }

def fuzz_delta(delta):
    return {
        "NF": trapmf(delta, -3, -1.5, -0.3, 0),
        "Z":  trimf(delta, -0.3, 0, 0.3),
        "PF": trapmf(delta, 0, 0.3, 1.5, 3),
    }

RULES = {
    ("PB","PF"):(4,0), ("PB","Z"):(4,0), ("PB","NF"):(3,0),
    ("PM","PF"):(3,0), ("PM","Z"):(3,0), ("PM","NF"):(1,2),
    ("Z","PF"):(1,1),  ("Z","Z"):(1,1),  ("Z","NF"):(0,1),
    ("NM","PF"):(1,1), ("NM","Z"):(0,2), ("NM","NF"):(0,2),
    ("NB","PF"):(0,2), ("NB","Z"):(0,2), ("NB","NF"):(0,2),
}
HEATER_PWM = {0:0, 1:50, 2:128, 3:192, 4:255}
FAN_PWM    = {0:0, 1:80, 2:255}

def fuzzy_inference(error, delta):
    mu_e, mu_d = fuzz_error(error), fuzz_delta(delta)
    h_n = h_d = f_n = f_d = 0.0
    for (el,dl),(hl,fl) in RULES.items():
        s = min(mu_e.get(el,0), mu_d.get(dl,0))
        if s <= 0: continue
        h_n += s*HEATER_PWM[hl]; h_d += s
        f_n += s*FAN_PWM[fl];    f_d += s
    return (int(h_n/h_d) if h_d else 0,
            int(f_n/f_d) if f_d else 0)

# ... (lihat source lengkap di repo)`;
