import { RULES, ERROR_MF, DELTA_MF, FLOW_STEPS } from "../constants/fuzzy";

export function FuzzyTab({ eZone }: { eZone: string }) {
  return (
    <div className="space-y-5">
      <div className="fade-up">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
          Logika <span style={{ color: "var(--brown)" }}>Fuzzy</span> Controller
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Metode Mamdani · Defuzzifikasi Center of Gravity
        </p>
      </div>

      {/* Alur kerja */}
      <div
        className="rounded-3xl p-6 fade-up"
        style={{ background: "var(--card-bg)", border: "1px solid var(--brown-border)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--muted)" }}>
          Alur Kerja
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          {FLOW_STEPS.map((s, i, arr) => (
            <span key={i} className="flex items-center gap-2">
              <span
                className="px-3 py-1.5 rounded-xl text-xs font-medium"
                style={{ background: "var(--brown-bg)", color: "var(--brown)", border: "1px solid var(--brown-border)" }}
              >
                {s}
              </span>
              {i < arr.length - 1 && <span style={{ color: "var(--muted)" }}>→</span>}
            </span>
          ))}
        </div>
      </div>

      {/* MF Error */}
      <div
        className="rounded-3xl overflow-hidden fade-up-1"
        style={{ background: "var(--card-bg)", border: "1px solid var(--brown-border)" }}
      >
        <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--brown-border)" }}>
          <p className="font-semibold text-sm">
            Membership Function — Error{" "}
            <span style={{ color: "var(--muted)", fontWeight: 400 }}>(Setpoint − Suhu)</span>
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left text-xs uppercase tracking-wider"
              style={{ color: "var(--muted)", borderBottom: "1px solid var(--brown-border)" }}
            >
              <th className="px-6 py-3">Label</th>
              <th className="px-6 py-3">Nama</th>
              <th className="px-6 py-3">Makna</th>
              <th className="px-6 py-3 font-mono">Fungsi</th>
            </tr>
          </thead>
          <tbody>
            {ERROR_MF.map((r) => (
              <tr
                key={r.label}
                style={{
                  borderTop: "1px solid rgba(139,94,60,0.07)",
                  background: r.label === eZone ? "var(--brown-bg)" : undefined,
                }}
              >
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
      <div
        className="rounded-3xl overflow-hidden fade-up-1"
        style={{ background: "var(--card-bg)", border: "1px solid var(--brown-border)" }}
      >
        <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--brown-border)" }}>
          <p className="font-semibold text-sm">
            Membership Function — ΔError{" "}
            <span style={{ color: "var(--muted)", fontWeight: 400 }}>(perubahan error)</span>
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left text-xs uppercase tracking-wider"
              style={{ color: "var(--muted)", borderBottom: "1px solid var(--brown-border)" }}
            >
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
      <div
        className="rounded-3xl overflow-hidden fade-up-2"
        style={{ background: "var(--card-bg)", border: "1px solid var(--brown-border)" }}
      >
        <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--brown-border)" }}>
          <p className="font-semibold text-sm">
            Rule Base — 15 Aturan{" "}
            <span style={{ color: "var(--muted)", fontWeight: 400 }}>IF Error AND ΔError THEN Heater, Fan</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left text-xs uppercase tracking-wider"
                style={{ color: "var(--muted)", borderBottom: "1px solid var(--brown-border)" }}
              >
                <th className="px-5 py-3">Error</th>
                <th className="px-5 py-3">ΔError</th>
                <th className="px-5 py-3">Heater</th>
                <th className="px-5 py-3">Fan</th>
              </tr>
            </thead>
            <tbody>
              {RULES.map((r, i) => (
                <tr
                  key={i}
                  style={{
                    borderTop: "1px solid rgba(139,94,60,0.07)",
                    background: r.error === eZone ? "var(--brown-bg)" : undefined,
                  }}
                >
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

      {/* COG + Emergency */}
      <div className="grid md:grid-cols-2 gap-4 fade-up-2">
        <div className="rounded-3xl p-6" style={{ background: "var(--card-bg)", border: "1px solid var(--brown-border)" }}>
          <p className="font-semibold text-sm mb-3">Defuzzifikasi — COG</p>
          <div className="rounded-xl p-4 font-mono text-xs space-y-1" style={{ background: "var(--brown-bg)" }}>
            <p style={{ color: "var(--muted)" }}>{`// Center of Gravity`}</p>
            <p>PWM_heater = Σ(μ · H) / Σ(μ)</p>
            <p>PWM_fan    = Σ(μ · F) / Σ(μ)</p>
            <p className="pt-1" style={{ color: "var(--muted)" }}>μ = min(μ_error, μ_delta)</p>
          </div>
        </div>
        <div
          className="rounded-3xl p-6"
          style={{ background: "rgba(192,57,43,0.05)", border: "1px solid rgba(192,57,43,0.2)" }}
        >
          <p className="font-semibold text-sm mb-3" style={{ color: "var(--warm-red)" }}>🛑 Emergency Cutoff</p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Jika suhu ≥ <b style={{ color: "var(--warm-red)" }}>42°C</b>, heater langsung PWM = 0 dan fan paksa
            PWM = 255 — berjalan <b>di luar</b> logika fuzzy sebagai lapisan proteksi keras.
          </p>
        </div>
      </div>
    </div>
  );
}
