import { handleEximbaySession } from "../../../src/lib/payment/eximbay-session.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const environmentName = Deno.env.get("EXIMBAY_ENVIRONMENT") === "live" ? "live" : "test";

Deno.serve((request) => handleEximbaySession(request, {
  apiKey: Deno.env.get("EXIMBAY_API_KEY") ?? "",
  apiOrigin: environmentName === "live"
    ? "https://api.eximbay.com"
    : "https://api-test.eximbay.com",
  mid: Deno.env.get("EXIMBAY_MID") ?? "",
  siteUrl: Deno.env.get("PAYMENT_SITE_URL") ?? "",
  supabasePublishableKey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
}));
