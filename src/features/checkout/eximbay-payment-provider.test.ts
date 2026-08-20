import { describe, expect, it, vi } from "vitest";

import type { EximbayPaymentSession } from "@/lib/payment/eximbay-types";
import { EximbayPaymentProvider } from "./eximbay-payment-provider";

const session = {
  sdkUrl: "https://api-test.eximbay.com/v2/javascriptSDK.js",
  request: {
    fgkey: "fg",
    payment: {
      transaction_type: "PAYMENT", order_id: "order-1", currency: "JPY",
      amount: "100", lang: "JP", payment_method: "P354",
    },
    merchant: { mid: "mid" },
    buyer: { name: "A", email: "a@example.jp" },
    url: { return_url: "https://site/return", status_url: "https://site/status" },
    other_param: { param1: "order-1" },
  },
} satisfies EximbayPaymentSession;

describe("EximbayPaymentProvider", () => {
  it("creates an order, prepares a server-signed session and launches the SDK", async () => {
    const createPaymentOrder = vi.fn(async () => ({ id: "order-1", status: "pending" as const }));
    const create = vi.fn(async () => session);
    const launch = vi.fn(async () => undefined);
    const provider = new EximbayPaymentProvider(
      { createPaymentOrder }, "/g/token/relation/pair", { create, launch },
    );
    await expect(provider.start({
      groupId: "g", memberA: "a", memberB: "b", method: "paypay",
      buyerName: "Aさん", buyerEmail: "a@example.jp",
    })).resolves.toEqual({ status: "launched" });
    expect(create).toHaveBeenCalledWith({
      orderId: "order-1", buyerName: "Aさん", buyerEmail: "a@example.jp",
      returnPath: "/g/token/relation/pair",
    });
    expect(launch).toHaveBeenCalledWith(session);
  });

  it("does not create a second provider session for a paid order", async () => {
    const client = { create: vi.fn(), launch: vi.fn() };
    const provider = new EximbayPaymentProvider({
      createPaymentOrder: vi.fn(async () => ({ id: "order-1", status: "paid" as const })),
    }, "/return", client);
    await expect(provider.start({
      groupId: "g", memberA: "a", memberB: "b", method: "card",
      buyerName: "A", buyerEmail: "a@example.jp",
    })).resolves.toEqual({ status: "confirmed" });
    expect(client.create).not.toHaveBeenCalled();
  });
});
