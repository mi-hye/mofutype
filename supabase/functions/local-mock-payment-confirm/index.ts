import { handleLocalMockConfirm } from "../../../src/lib/payment/local-mock-confirm.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

Deno.serve((request) => handleLocalMockConfirm(request, {
  serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  supabasePublishableKey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
}));
