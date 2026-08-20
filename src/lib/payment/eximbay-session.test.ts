import { describe, expect, it, vi } from "vitest";

import { handleEximbaySession } from "./eximbay-session";

const environment = {
  apiKey: "private-api-key",
  apiOrigin: "https://api-test.eximbay.com",
  mid: "merchant-1",
  siteUrl: "https://mofutype.example",
  supabasePublishableKey: "publishable-key",
  supabaseUrl: "https://project.supabase.co",
};
const orderId = "d9428888-122b-4e1f-b85c-61e0344f2a92";

function request(body: object, authorization = "Bearer user-token") {
  return new Request("https://project.supabase.co/functions/v1/eximbay-payment-session", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("handleEximbaySession", () => {
  it("loads the server-priced order and prepares an exact PayPay session", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json([{
        id: orderId, amount_jpy: 300, currency: "JPY", method: "paypay", status: "pending",
      }]))
      .mockResolvedValueOnce(Response.json({ rescode: "0000", fgkey: "signed-fgkey" }));
    const response = await handleEximbaySession(request({
      orderId,
      buyerName: "Aさん",
      buyerEmail: "buyer@example.jp",
      returnPath: "/g/invite/relation/pair",
    }), environment, fetcher);

    expect(response.status).toBe(200);
    const session = await response.json();
    expect(session).toEqual({
      sdkUrl: "https://api-test.eximbay.com/v2/javascriptSDK.js",
      request: {
        fgkey: "signed-fgkey",
        payment: {
          transaction_type: "PAYMENT", order_id: expect.stringMatching(/^[0-9a-f-]{36}$/), currency: "JPY",
          amount: "300", lang: "JP", payment_method: "P354",
        },
        merchant: { mid: "merchant-1" },
        buyer: { name: "Aさん", email: "buyer@example.jp" },
        url: {
          return_url: "https://mofutype.example/g/invite/relation/pair",
          status_url: "https://project.supabase.co/functions/v1/eximbay-payment-status",
        },
        other_param: { param1: orderId },
      },
    });
    expect(fetcher.mock.calls[0][1].headers).toMatchObject({
      authorization: "Bearer user-token", apikey: "publishable-key",
    });
    const ready = JSON.parse(String(fetcher.mock.calls[1][1].body));
    expect(ready.payment.amount).toBe("300");
    expect(ready.payment.order_id).not.toBe(orderId);
    expect(ready.other_param).toEqual({ param1: orderId });
    expect(JSON.stringify(session)).not.toContain("private-api-key");
  });

  it("rejects unauthenticated, unsafe return paths, and manipulated orders", async () => {
    await expect(handleEximbaySession(request({
      orderId, buyerName: "A", buyerEmail: "a@example.jp", returnPath: "/ok",
    }, ""), environment, vi.fn())).resolves.toHaveProperty("status", 401);
    await expect(handleEximbaySession(request({
      orderId, buyerName: "A", buyerEmail: "a@example.jp", returnPath: "//evil.example",
    }), environment, vi.fn())).resolves.toHaveProperty("status", 400);
    const fetcher = vi.fn(async () => Response.json([{
      id: orderId, amount_jpy: 301, currency: "JPY", method: "paypay", status: "pending",
    }]));
    await expect(handleEximbaySession(request({
      orderId, buyerName: "A", buyerEmail: "a@example.jp", returnPath: "/ok",
    }), environment, fetcher)).resolves.toHaveProperty("status", 409);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
