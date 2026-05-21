import type { SupabaseClient } from "@supabase/supabase-js";

let supabaseClientRequest: Promise<SupabaseClient> | null = null;

export async function getSupabaseClient() {
  if (!supabaseClientRequest) {
    supabaseClientRequest = import("./supabase").then((module) => module.supabase);
  }

  return supabaseClientRequest;
}
