import { createClient } from "@supabase/supabase-js";
import type { InkubatorLog } from "../types/inkubator";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);
export type { InkubatorLog };
