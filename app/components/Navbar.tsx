"use client";

type Tab = "dashboard" | "fuzzy" | "riwayat";

const TABS: { key: Tab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "fuzzy",     label: "Fuzzy Logic" },
  { key: "riwayat",   label: "Riwayat" },
];

export function Navbar({ tab, onTabChange }: { tab: Tab; onTabChange: (t: Tab) => void }) {
  return (
    <nav className="w-full max-w-5xl mx-auto px-6 py-5 flex items-center justify-between fade-up">
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-lg"
          style={{ background: "linear-gradient(135deg, #8b5e3c, #c4956a)" }}
        >
          🥚
        </div>
        <div>
          <p className="font-bold text-base leading-tight" style={{ color: "var(--foreground)" }}>
            Inkubator Telur
          </p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Fuzzy Logic Control · ESP32
          </p>
        </div>
      </div>

      <div
        className="flex items-center gap-1 p-1 rounded-full"
        style={{ background: "var(--brown-bg)", border: "1px solid var(--brown-border)" }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => onTabChange(t.key)}
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
  );
}

export type { Tab };
