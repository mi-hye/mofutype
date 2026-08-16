import { handlePaymentWebhook } from "../../../src/lib/payment/webhook-handler.ts";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

Deno.serve((request) => handlePaymentWebhook(request, {
  webhookSecret: Deno.env.get("PAYMENT_WEBHOOK_SECRET") ?? "",
  supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
  serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
}));
