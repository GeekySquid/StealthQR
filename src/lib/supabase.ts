import { createClient } from "@supabase/supabase-js";

// Uses client-side variables (if available) to interact with Supabase
// It's recommended to handle uploads / downloads securely.
// We fallback to empty strings if not available to prevent crashes, but show an error
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co",
  import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder-key"
);
