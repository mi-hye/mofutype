import { describe, expect, it, vi } from "vitest";

import { handleEximbayStatus } from "./eximbay-status";

const environment = {
  apiKey: "private-key",
  apiOrigin: "https://api-test.eximbay.com",
  mid: "merchant-1",
  serviceRoleKey: "service-secret",
  supabaseUrl: "https://project.supabase.co",
};
const orderId = "d9428888-122b-4e1f-b85c-61e0344f2a92";
const validBody = new URLSearchParams({
  rescode: "0000",
  transaction_type: "PAYMENT",
  mid: "merchant-1",
  currency: "JPY",
  amount: "300",
  order_id: orderId,
  param1: orderId,
  transaction_id: "tx-123",
  payment_method: "P354",
  fgkey: "signed",
}).toString();

describe("handleEximbayStatus", () => {
  it("verifies the exact provider payload before the service-role confirmation", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ rescode: "0000", resmsg: "Success" }))
      .mockResolvedValueOnce(Response.json([{ id: "unlock-1" }]));
    const response = await handleEximbayStatus(new Request("https://status.example", {
      method: "POST", body: validBody,
    }), environment, fetcher);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("rescode=0000&resmsg=Success");
    expect(fetcher.mock.calls[0][0]).toBe("https://api-test.eximbay.com/v1/payments/verify");
    expect(JSON.parse(String(fetcher.mock.calls[0][1].body))).toEqual({ data: validBody });
    expect(fetcher.mock.calls[1][0]).toBe(
      "https://project.supabase.co/rest/v1/rpc/confirm_payment_order",
    );
    expect(JSON.parse(String(fetcher.mock.calls[1][1].body))).toEqual({
      p_order_id: orderId,
      p_provider: "eximbay",
      p_provider_reference: "tx-123",
    });
  });

  it("never confirms failed, modified, or unverified responses", async () => {
    const failed = new URLSearchParams(validBody);
    failed.set("amount", "301");
    const noFetch = vi.fn();
    await expect(handleEximbayStatus(new Request("https://status.example", {
      method: "POST", body: failed.toString(),
    }), environment, noFetch)).resolves.toHaveProperty("status", 400);
    expect(noFetch).not.toHaveBeenCalled();

    const fetcher = vi.fn(async () => Response.json({ rescode: "VE00" }));
    await expect(handleEximbayStatus(new Request("https://status.example", {
      method: "POST", body: validBody,
    }), environment, fetcher)).resolves.toHaveProperty("status", 502);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
