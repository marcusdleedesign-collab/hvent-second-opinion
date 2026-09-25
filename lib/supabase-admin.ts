import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET;

if (!supabaseUrl || !supabaseSecretKey || !storageBucket) {
  throw new Error(
    "Missing required Supabase environment variables."
  );
}

export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export const SUPABASE_STORAGE_BUCKET = storageBucket;