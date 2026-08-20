export interface LocalMockEnvironment {
  serviceRoleKey: string;
  supabasePublishableKey: string;
  supabaseUrl: string;
}

export type LocalMockFetch = (input: string, init: RequestInit) => Promise<Response>;
const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

function json(body: object, status: number): Response {
  return Response.json(body, { status, headers: {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "cache-control": "no-store",
  } });
}

export async function handleLocalMockConfirm(
  request: Request,
  environment: LocalMockEnvironment,
  fetcher: LocalMockFetch = fetch,
): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    },
  });
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  let base: URL;
  try { base = new URL(environment.supabaseUrl); } catch {
    return json({ error: "NOT_AVAILABLE" }, 404);
  }
  if (!["127.0.0.1", "localhost"].includes(base.hostname) ||
      !environment.serviceRoleKey || !environment.supabasePublishableKey) {
    return json({ error: "NOT_AVAILABLE" }, 404);
  }
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/.test(authorization)) return json({ error: "UNAUTHORIZED" }, 401);
  let orderId = "";
  try {
    const body = await request.json() as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body) || Reflect.ownKeys(body).length !== 1) {
      throw new Error();
    }
    orderId = (body as { orderId?: unknown }).orderId as string;
  } catch {
    return json({ error: "INVALID_REQUEST" }, 400);
  }
  if (typeof orderId !== "string" || !UUID.test(orderId)) {
    return json({ error: "INVALID_REQUEST" }, 400);
  }
  const visible = await fetcher(
    new URL(`/rest/v1/payment_orders?id=eq.${orderId}&select=id,status`, base).toString(),
    { headers: { authorization, apikey: environment.supabasePublishableKey } },
  );
  let rows: unknown;
  try { rows = await visible.json(); } catch { rows = null; }
  if (!visible.ok || !Array.isArray(rows) || rows.length !== 1) {
    return json({ error: "ORDER_NOT_FOUND" }, 404);
  }
  const confirmed = await fetcher(new URL("/rest/v1/rpc/confirm_payment_order", base).toString(), {
    method: "POST",
    headers: {
      apikey: environment.serviceRoleKey,
      authorization: `Bearer ${environment.serviceRoleKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      p_order_id: orderId,
      p_provider: "mock",
      p_provider_reference: `mock-${orderId.replaceAll("-", "")}`,
    }),
  });
  if (!confirmed.ok) return json({ error: "CONFIRMATION_FAILED" }, 502);
  return json({ ok: true }, 200);
}
