import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

export interface InkubatorLog {
  id: number;
  created_at: string;
  suhu: number;
  humidity: number;
  heater: number;
  fan: number;
  setpoint: number;
}
