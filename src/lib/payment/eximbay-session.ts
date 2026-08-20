import type { EximbayPaymentSession } from "./eximbay-types";

export interface EximbaySessionEnvironment {
  apiKey: string;
  apiOrigin: string;
  mid: string;
  siteUrl: string;
  supabasePublishableKey: string;
  supabaseUrl: string;
}

export type EximbaySessionFetch = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: object, status: number): Response {
  return Response.json(body, { status, headers: {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "cache-control": "no-store",
  } });
}

function configured(environment: EximbaySessionEnvironment): boolean {
  return Object.values(environment).every((value) => value.trim().length > 0);
}

function safeApiOrigin(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "api.eximbay.com" || url.hostname === "api-test.eximbay.com")
      ? url
      : null;
  } catch {
    return null;
  }
}

function parseInput(value: unknown): {
  orderId: string;
  buyerName: string;
  buyerEmail: string;
  returnPath: string;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Reflect.ownKeys(row).length !== 4) return null;
  const { orderId, buyerName, buyerEmail, returnPath } = row;
  if (
    typeof orderId !== "string" || !UUID.test(orderId) ||
    typeof buyerName !== "string" || buyerName !== buyerName.trim() ||
    buyerName.length < 1 || buyerName.length > 80 ||
    typeof buyerEmail !== "string" || buyerEmail !== buyerEmail.trim() ||
    buyerEmail.length > 254 || !EMAIL.test(buyerEmail) ||
    typeof returnPath !== "string" || !returnPath.startsWith("/") ||
    returnPath.startsWith("//") || returnPath.length > 1000
  ) return null;
  return { orderId, buyerName, buyerEmail, returnPath };
}

function basicAuthorization(apiKey: string): string {
  const bytes = new TextEncoder().encode(`${apiKey}:`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}

export async function handleEximbaySession(
  request: Request,
  environment: EximbaySessionEnvironment,
  fetcher: EximbaySessionFetch = fetch,
): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    },
  });
  if (!configured(environment)) return json({ error: "NOT_CONFIGURED" }, 503);
  if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const authorization = request.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/.test(authorization)) return json({ error: "UNAUTHORIZED" }, 401);
  const apiOrigin = safeApiOrigin(environment.apiOrigin);
  if (!apiOrigin) return json({ error: "NOT_CONFIGURED" }, 503);

  let input: ReturnType<typeof parseInput>;
  try {
    const raw = await request.text();
    if (raw.length > 4096) throw new Error("large");
    input = parseInput(JSON.parse(raw) as unknown);
  } catch {
    input = null;
  }
  if (!input) return json({ error: "INVALID_REQUEST" }, 400);

  let siteUrl: URL;
  let supabaseUrl: URL;
  try {
    siteUrl = new URL(environment.siteUrl);
    supabaseUrl = new URL(environment.supabaseUrl);
    if (siteUrl.protocol !== "https:" || supabaseUrl.protocol !== "https:") throw new Error();
  } catch {
    return json({ error: "NOT_CONFIGURED" }, 503);
  }

  let orderResponse: Response;
  try {
    orderResponse = await fetcher(
      new URL(`/rest/v1/payment_orders?id=eq.${input.orderId}&select=id,amount_jpy,currency,method,status`, supabaseUrl).toString(),
      {
        headers: {
          apikey: environment.supabasePublishableKey,
          authorization,
          accept: "application/json",
        },
      },
    );
  } catch {
    return json({ error: "ORDER_UNAVAILABLE" }, 502);
  }
  if (!orderResponse.ok) return json({ error: "ORDER_UNAVAILABLE" }, 502);
  let orders: unknown;
  try { orders = await orderResponse.json(); } catch { orders = null; }
  if (!Array.isArray(orders) || orders.length !== 1) return json({ error: "ORDER_NOT_FOUND" }, 404);
  const order = orders[0] as Record<string, unknown>;
  if (order.id !== input.orderId || order.amount_jpy !== 100 || order.currency !== "JPY" ||
      !["paypay", "card"].includes(String(order.method)) || order.status !== "pending") {
    return json({ error: "INVALID_ORDER" }, 409);
  }

  const payment = {
    transaction_type: "PAYMENT" as const,
    // Eximbay forbids reusing a failed order ID. Keep our idempotent internal
    // order in signed param1 and create a fresh provider attempt ID each time.
    order_id: crypto.randomUUID(),
    currency: "JPY" as const,
    amount: "100" as const,
    lang: "JP" as const,
    payment_method: order.method === "paypay" ? "P354" as const : "P000" as const,
  };
  const statusUrl = new URL("/functions/v1/eximbay-payment-status", supabaseUrl).toString();
  const returnUrl = new URL(input.returnPath, siteUrl).toString();
  const readyBody = {
    payment,
    merchant: { mid: environment.mid },
    buyer: { name: input.buyerName, email: input.buyerEmail },
    url: { return_url: returnUrl, status_url: statusUrl },
    other_param: { param1: input.orderId },
  };
  let readyResponse: Response;
  try {
    readyResponse = await fetcher(new URL("/v1/payments/ready", apiOrigin).toString(), {
      method: "POST",
      headers: {
        authorization: basicAuthorization(environment.apiKey),
        "content-type": "application/json",
      },
      body: JSON.stringify(readyBody),
    });
  } catch {
    return json({ error: "PAYMENT_PROVIDER_UNAVAILABLE" }, 502);
  }
  if (!readyResponse.ok) return json({ error: "PAYMENT_PROVIDER_UNAVAILABLE" }, 502);
  let ready: unknown;
  try { ready = await readyResponse.json(); } catch { ready = null; }
  const fgkey = ready && typeof ready === "object" && !Array.isArray(ready) &&
    (ready as Record<string, unknown>).rescode === "0000" &&
    typeof (ready as Record<string, unknown>).fgkey === "string"
    ? (ready as Record<string, string>).fgkey
    : null;
  if (!fgkey || fgkey.length > 512) return json({ error: "PAYMENT_PROVIDER_UNAVAILABLE" }, 502);

  const session: EximbayPaymentSession = {
    sdkUrl: new URL("/v2/javascriptSDK.js", apiOrigin).toString(),
    request: { fgkey, ...readyBody },
  };
  return json(session, 200);
}
