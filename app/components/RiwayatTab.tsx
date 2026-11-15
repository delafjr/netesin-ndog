"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, type InkubatorLog } from "../utils/supabase";

export function RiwayatTab() {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate,   setEndDate]   = useState(today);
  const [rows,      setRows]      = useState<InkubatorLog[]>([]);
  const [loading,   setLoading]   = useState(true);

  const fetchRows = useCallback(async (start: string, end: string) => {
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

  useEffect(() => { fetchRows(today, today); }, [fetchRows, today]);

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
      <div
        className="rounded-3xl p-5 fade-up"
        style={{ background: "var(--card-bg)", border: "1px solid var(--brown-border)" }}
      >
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1">
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: "var(--muted)" }}
            >
              Dari
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "var(--brown-bg)", border: "1px solid var(--brown-border)", color: "var(--foreground)" }}
            />
          </div>
          <div className="flex-1">
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: "var(--muted)" }}
            >
              Sampai
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "var(--brown-bg)", border: "1px solid var(--brown-border)", color: "var(--foreground)" }}
            />
          </div>
          <button
            onClick={() => fetchRows(startDate, endDate)}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #8b5e3c, #c4956a)", boxShadow: "0 2px 10px rgba(139,94,60,0.35)" }}
          >
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
            <div
              key={s.label}
              className="rounded-2xl p-4 text-center"
              style={{ background: "var(--card-bg)", border: "1px solid var(--brown-border)" }}
            >
              <p className="text-xs uppercase tracking-wider" style={{ color: "var(--muted)" }}>{s.label}</p>
              <p className="text-xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-3xl overflow-hidden fade-up-2"
        style={{ background: "var(--card-bg)", border: "1px solid var(--brown-border)", boxShadow: "0 4px 24px var(--brown-bg)" }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left text-xs uppercase tracking-wider"
              style={{ color: "var(--muted)", borderBottom: "1px solid var(--brown-border)", background: "var(--brown-bg)" }}
            >
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
              <tr>
                <td colSpan={6} className="text-center py-12" style={{ color: "var(--muted)" }}>Memuat...</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12" style={{ color: "var(--muted)" }}>
                  Tidak ada data di rentang tanggal ini.
                </td>
              </tr>
            )}
            {rows.map((l, i) => (
              <tr
                key={l.id}
                style={{
                  borderTop: "1px solid rgba(139,94,60,0.07)",
                  background: i % 2 === 1 ? "rgba(139,94,60,0.02)" : undefined,
                }}
              >
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
