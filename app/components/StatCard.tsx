export function StatCard({
  label,
  value,
  unit,
  color,
  bg,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
  bg: string;
}) {
  return (
    <div
      className="rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5"
      style={{ background: "var(--card-bg)", border: `1px solid ${bg}`, boxShadow: `0 4px 20px ${bg}` }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>
        {value}
        <span className="text-sm font-normal ml-1">{unit}</span>
      </p>
    </div>
  );
}
