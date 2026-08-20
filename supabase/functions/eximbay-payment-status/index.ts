import { handleEximbayStatus } from "../../../src/lib/payment/eximbay-status.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const environmentName = Deno.env.get("EXIMBAY_ENVIRONMENT") === "live" ? "live" : "test";

Deno.serve((request) => handleEximbayStatus(request, {
  apiKey: Deno.env.get("EXIMBAY_API_KEY") ?? "",
  apiOrigin: environmentName === "live"
    ? "https://api.eximbay.com"
    : "https://api-test.eximbay.com",
  mid: Deno.env.get("EXIMBAY_MID") ?? "",
  serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
}));
