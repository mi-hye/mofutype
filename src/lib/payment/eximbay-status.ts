export interface EximbayStatusEnvironment {
  apiKey: string;
  apiOrigin: string;
  mid: string;
  serviceRoleKey: string;
  supabaseUrl: string;
}

export type EximbayStatusFetch = (input: string, init: RequestInit) => Promise<Response>;

function text(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

function basicAuthorization(apiKey: string): string {
  const bytes = new TextEncoder().encode(`${apiKey}:`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}

export async function handleEximbayStatus(
  request: Request,
  environment: EximbayStatusEnvironment,
  fetcher: EximbayStatusFetch = fetch,
): Promise<Response> {
  if (request.method !== "POST") return text("rescode=0405&resmsg=Method+not+allowed", 405);
  if (Object.values(environment).some((value) => !value.trim())) {
    return text("rescode=0503&resmsg=Not+configured", 503);
  }
  let raw: string;
  try {
    raw = await request.text();
    if (!raw || raw.length > 16384) throw new Error();
  } catch {
    return text("rescode=0400&resmsg=Invalid+payload", 400);
  }
  const params = new URLSearchParams(raw);
  const orderId = params.get("param1") ?? "";
  const providerOrderId = params.get("order_id") ?? "";
  const transactionId = params.get("transaction_id") ?? "";
  if (
    params.get("rescode") !== "0000" || params.get("transaction_type") !== "PAYMENT" ||
    params.get("mid") !== environment.mid || params.get("currency") !== "JPY" ||
    params.get("amount") !== "300" || !/^[0-9a-f-]{36}$/i.test(orderId) ||
    !/^[0-9a-f-]{36}$/i.test(providerOrderId) ||
    transactionId.length < 1 || transactionId.length > 200
  ) return text("rescode=0400&resmsg=Invalid+payment", 400);

  let apiOrigin: URL;
  try { apiOrigin = new URL(environment.apiOrigin); } catch {
    return text("rescode=0503&resmsg=Not+configured", 503);
  }
  if (apiOrigin.protocol !== "https:" ||
      !["api.eximbay.com", "api-test.eximbay.com"].includes(apiOrigin.hostname)) {
    return text("rescode=0503&resmsg=Not+configured", 503);
  }
  let verified: Response;
  try {
    verified = await fetcher(new URL("/v1/payments/verify", apiOrigin).toString(), {
      method: "POST",
      headers: {
        authorization: basicAuthorization(environment.apiKey),
        "content-type": "application/json",
      },
      body: JSON.stringify({ data: raw }),
    });
  } catch {
    return text("rescode=0502&resmsg=Verification+failed", 502);
  }
  let verification: unknown;
  try { verification = await verified.json(); } catch { verification = null; }
  if (!verified.ok || !verification || typeof verification !== "object" ||
      (verification as Record<string, unknown>).rescode !== "0000") {
    return text("rescode=0502&resmsg=Verification+failed", 502);
  }

  let supabaseUrl: URL;
  try { supabaseUrl = new URL(environment.supabaseUrl); } catch {
    return text("rescode=0503&resmsg=Not+configured", 503);
  }
  if (supabaseUrl.protocol !== "https:") {
    return text("rescode=0503&resmsg=Not+configured", 503);
  }
  let confirmed: Response;
  try {
    confirmed = await fetcher(new URL("/rest/v1/rpc/confirm_payment_order", supabaseUrl).toString(), {
      method: "POST",
      headers: {
        apikey: environment.serviceRoleKey,
        authorization: `Bearer ${environment.serviceRoleKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_order_id: orderId,
        p_provider: "eximbay",
        p_provider_reference: transactionId,
      }),
    });
  } catch {
    return text("rescode=0502&resmsg=Confirmation+failed", 502);
  }
  if (!confirmed.ok) return text("rescode=0502&resmsg=Confirmation+failed", 502);
  return text("rescode=0000&resmsg=Success", 200);
}
