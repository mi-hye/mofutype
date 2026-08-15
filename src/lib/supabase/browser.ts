import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppDatabase } from "./app-database.types";

export class SupabaseConfigurationError extends Error {
  readonly code = "MISSING_SUPABASE_CONFIG" as const;

  constructor(options?: ErrorOptions) {
    super("Supabase browser configuration is missing or invalid.", options);
    this.name = "SupabaseConfigurationError";
  }
}

export type SupabaseBrowserClientFactory = (
  url: string,
  publishableKey: string,
) => SupabaseClient<AppDatabase>;

export function createSupabaseBrowserClient(
  factory: SupabaseBrowserClientFactory = (url, publishableKey) =>
    createBrowserClient<AppDatabase>(url, publishableKey),
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

  try {
    if (!url || !publishableKey) {
      throw new Error("Missing configuration");
    }
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new Error("Unsupported URL protocol");
    }
  } catch (cause) {
    throw new SupabaseConfigurationError({ cause });
  }

  try {
    return factory(url, publishableKey);
  } catch (cause) {
    throw new SupabaseConfigurationError({ cause });
  }
}
