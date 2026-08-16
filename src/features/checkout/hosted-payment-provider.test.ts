import { describe, expect, it, vi } from "vitest";

import { HostedPaymentProvider } from "./hosted-payment-provider";

const request = {
  groupId: "group-1",
  memberA: "member-2",
  memberB: "member-1",
  method: "paypay" as const,
};

describe("HostedPaymentProvider", () => {
  it("creates the server-priced order before requesting a hosted checkout", async () => {
    const createPaymentOrder = vi.fn(async () => ({
      id: "order-1",
      method: "paypay" as const,
      status: "pending" as const,
    }));
    const createCheckoutSession = vi.fn(async () => ({
      checkoutUrl: "https://checkout.example/order-1",
    }));
    const provider = new HostedPaymentProvider(
      { createPaymentOrder },
      { createCheckoutSession },
    );

    await expect(provider.start(request)).resolves.toEqual({
      status: "redirect",
      checkoutUrl: "https://checkout.example/order-1",
    });
    expect(createPaymentOrder).toHaveBeenCalledWith(
      "group-1", "member-2", "member-1", "paypay",
    );
    expect(createCheckoutSession).toHaveBeenCalledWith({
      orderId: "order-1",
      method: "paypay",
    });
  });

  it("uses the persisted method when another member reuses a pending order", async () => {
    const createCheckoutSession = vi.fn(async () => ({
      checkoutUrl: "https://checkout.example/order-1",
    }));
    const provider = new HostedPaymentProvider(
      { createPaymentOrder: vi.fn(async () => ({
        id: "order-1",
        method: "paypay" as const,
        status: "pending" as const,
      })) },
      { createCheckoutSession },
    );

    await provider.start({ ...request, method: "card" });
    expect(createCheckoutSession).toHaveBeenCalledWith({
      orderId: "order-1",
      method: "paypay",
    });
  });

  it("does not open another checkout for an order already marked paid", async () => {
    const createCheckoutSession = vi.fn();
    const provider = new HostedPaymentProvider(
      { createPaymentOrder: vi.fn(async () => ({
        id: "order-1",
        method: "paypay" as const,
        status: "paid" as const,
      })) },
      { createCheckoutSession },
    );

    await expect(provider.start(request)).resolves.toEqual({ status: "confirmed" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });
});
