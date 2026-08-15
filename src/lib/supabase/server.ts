import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { AppDatabase } from "./app-database.types";
import { SupabaseConfigurationError } from "./browser";

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

  try {
    if (!url || !publishableKey) throw new Error("Missing configuration");
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new Error("Unsupported URL protocol");
    }
  } catch (cause) {
    throw new SupabaseConfigurationError({ cause });
  }

  const cookieStore = await cookies();
  return createServerClient<AppDatabase>(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {
        // Server Components cannot write cookies. Session refresh remains owned
        // by the browser client; this client only reads the existing session.
      },
    },
  });
}
