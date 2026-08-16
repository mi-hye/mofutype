import { describe, expect, it, vi } from "vitest";

import { handlePaymentWebhook } from "./webhook-handler";

const environment = {
  webhookSecret: "test-webhook-secret",
  supabaseUrl: "https://project.supabase.co",
  serviceRoleKey: "service-role-secret",
};

function webhookRequest(
  body: unknown,
  secret = environment.webhookSecret,
): Request {
  return new Request("https://functions.example/payment-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-mofu-webhook-secret": secret,
    },
    body: JSON.stringify(body),
  });
}

describe("payment webhook handler", () => {
  it("rejects unauthorized requests before calling Supabase", async () => {
    const fetcher = vi.fn();
    const response = await handlePaymentWebhook(
      webhookRequest({}, "wrong-secret"),
      environment,
      fetcher,
    );

    expect(response.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ error: "UNAUTHORIZED" });
  });

  it("accepts only the exact provider confirmation payload", async () => {
    const fetcher = vi.fn();
    for (const body of [
      {},
      { orderId: "order-1", provider: "mock" },
      { orderId: "order-1", provider: "Mock", providerReference: "ref-1" },
      { orderId: "order-1", provider: "mock", providerReference: "ref-1", secret: "raw" },
    ]) {
      const response = await handlePaymentWebhook(webhookRequest(body), environment, fetcher);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "INVALID_PAYLOAD" });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("confirms an exact order through the server-only RPC", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([{ id: "private-unlock" }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const response = await handlePaymentWebhook(webhookRequest({
      orderId: "8b54125d-1af7-4eb8-ae13-3d3292613f2a",
      provider: "mock",
      providerReference: "payment-ref-1",
    }), environment, fetcher);

    expect(response.status).toBe(200);
    const responseText = await response.text();
    expect(JSON.parse(responseText)).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledWith(
      "https://project.supabase.co/rest/v1/rpc/confirm_payment_order",
      {
        method: "POST",
        headers: {
          apikey: "service-role-secret",
          authorization: "Bearer service-role-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          p_order_id: "8b54125d-1af7-4eb8-ae13-3d3292613f2a",
          p_provider: "mock",
          p_provider_reference: "payment-ref-1",
        }),
      },
    );
    expect(responseText).not.toContain("private-unlock");
  });

  it("returns only a stable error when the private RPC fails", async () => {
    const fetcher = vi.fn(async () => new Response("private database failure", { status: 500 }));
    const response = await handlePaymentWebhook(webhookRequest({
      orderId: "8b54125d-1af7-4eb8-ae13-3d3292613f2a",
      provider: "mock",
      providerReference: "payment-ref-1",
    }), environment, fetcher);

    expect(response.status).toBe(502);
    const responseText = await response.text();
    expect(JSON.parse(responseText)).toEqual({ error: "CONFIRMATION_FAILED" });
    expect(responseText).not.toContain("private database failure");
  });

  it("fails closed when server secrets are not configured", async () => {
    const fetcher = vi.fn();
    const response = await handlePaymentWebhook(
      webhookRequest({}),
      { ...environment, webhookSecret: "" },
      fetcher,
    );

    expect(response.status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ error: "NOT_CONFIGURED" });
  });
});
