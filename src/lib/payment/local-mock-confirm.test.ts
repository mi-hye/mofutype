import { describe, expect, it, vi } from "vitest";

import { handleLocalMockConfirm } from "./local-mock-confirm";

const orderId = "d9428888-122b-4e1f-b85c-61e0344f2a92";

describe("handleLocalMockConfirm", () => {
  it("works only against the local Supabase stack", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json([{ id: orderId, status: "pending" }]))
      .mockResolvedValueOnce(Response.json([{ id: "unlock" }]));
    const response = await handleLocalMockConfirm(new Request("http://local/function", {
      method: "POST",
      headers: { authorization: "Bearer local-user" },
      body: JSON.stringify({ orderId }),
    }), {
      serviceRoleKey: "local-service-role",
      supabasePublishableKey: "local-anon",
      supabaseUrl: "http://127.0.0.1:54321",
    }, fetcher);
    expect(response.status).toBe(200);
    expect(JSON.parse(String(fetcher.mock.calls[1][1].body))).toEqual({
      p_order_id: orderId,
      p_provider: "mock",
      p_provider_reference: "mock-d9428888122b4e1fb85c61e0344f2a92",
    });
  });

  it("cannot run against a hosted project", async () => {
    const fetcher = vi.fn();
    const response = await handleLocalMockConfirm(new Request("https://remote/function", {
      method: "POST", headers: { authorization: "Bearer user" }, body: JSON.stringify({ orderId }),
    }), {
      serviceRoleKey: "secret", supabasePublishableKey: "anon",
      supabaseUrl: "https://project.supabase.co",
    }, fetcher);
    expect(response.status).toBe(404);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
