"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, type InkubatorLog } from "./utils/supabase";
import { makeDummy } from "./utils/dummy";
import { Navbar, type Tab } from "./components/Navbar";
import { DashboardTab } from "./components/DashboardTab";
import { FuzzyTab } from "./components/FuzzyTab";
import { RiwayatTab } from "./components/RiwayatTab";

export default function Home() {
  const [tab,      setTab]     = useState<Tab>("dashboard");
  const [logs,     setLogs]    = useState<InkubatorLog[]>([]);
  const [loading,  setLoading] = useState(true);
  const [notice,   setNotice]  = useState<string | null>(null);
  const [isDummy,  setIsDummy] = useState(false);

  const fetchData = useCallback(async () => {
    const { data, error } = await supabase
      .from("inkubator_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      setLogs(prev => (prev.length && !isDummy ? prev : makeDummy()));
      setIsDummy(true);
      setNotice(error ? "Koneksi Supabase gagal — data contoh." : "ESP32 belum push data — data contoh.");
    } else {
      // fetch 20 untuk dashboard stats
      const { data: full } = await supabase
        .from("inkubator_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      setLogs(full ?? data);
      setIsDummy(false);
      setNotice(null);
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 5000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const latest   = logs[0] ?? null;
  const isOnline = !!latest && Date.now() - new Date(latest.created_at).getTime() < 30_000;
  const errorVal = (latest?.setpoint ?? 38) - (latest?.suhu ?? 0);
  const eZone    = errorVal > 2 ? "PB" : errorVal > 0 ? "PM" : errorVal > -1 ? "Z" : errorVal > -3 ? "NM" : "NB";

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <Navbar tab={tab} onTabChange={setTab} />

      <main className="max-w-5xl mx-auto px-6 pb-16 space-y-6">
        {notice && (
          <div
            className="px-4 py-3 rounded-2xl text-sm flex items-center gap-2"
            style={{ background: "var(--amber-bg)", border: "1px solid rgba(212,124,46,0.25)", color: "var(--amber)" }}
          >
            <span>⚠️</span>
            <span>{notice}{isDummy && " (data contoh)"}</span>
          </div>
        )}

        {tab === "dashboard" && (
          <DashboardTab latest={latest} loading={loading} isOnline={isOnline} />
        )}
        {tab === "fuzzy" && (
          <FuzzyTab eZone={eZone} />
        )}
        {tab === "riwayat" && (
          <RiwayatTab />
        )}
      </main>

      <footer
        className="text-center text-xs py-8"
        style={{ color: "var(--muted)", borderTop: "1px solid var(--brown-border)" }}
      >
        Inkubator Telur — Fuzzy Logic Control · Sinyal &amp; Sistem Kontrol Elektronik
      </footer>
    </div>
  );
}
