const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface InkubatorLog {
  id: number;
  created_at: string;
  suhu: number;
  humidity: number;
  heater: number;
  fan: number;
  setpoint: number;
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

export async function fetchLogs(limit = 100): Promise<InkubatorLog[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/inkubator_log?order=created_at.desc&limit=${limit}`,
    { headers, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return res.json();
}

export async function fetchLatest(): Promise<InkubatorLog | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/inkubator_log?order=created_at.desc&limit=1`,
    { headers, cache: "no-store" }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data[0] ?? null;
}
