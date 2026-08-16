export interface PaymentWebhookEnvironment {
  webhookSecret: string;
  supabaseUrl: string;
  serviceRoleKey: string;
}

export type PaymentWebhookFetch = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

const ORDER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,29}$/;

function jsonResponse(body: object, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

async function secretsMatch(supplied: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [suppliedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(suppliedHash);
  const right = new Uint8Array(expectedHash);
  let difference = supplied.length ^ expected.length;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function exactConfirmation(value: unknown): {
  orderId: string;
  provider: string;
  providerReference: string;
} | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const keys = Reflect.ownKeys(value);
  const expectedKeys = ["orderId", "provider", "providerReference"];
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
  ) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (expectedKeys.some((key) => {
    const descriptor = descriptors[key];
    return !descriptor || !("value" in descriptor) || !descriptor.enumerable;
  })) return null;
  const orderId = descriptors.orderId.value;
  const provider = descriptors.provider.value;
  const providerReference = descriptors.providerReference.value;
  if (
    typeof orderId !== "string" ||
    !ORDER_ID_PATTERN.test(orderId) ||
    typeof provider !== "string" ||
    !PROVIDER_PATTERN.test(provider) ||
    typeof providerReference !== "string" ||
    providerReference !== providerReference.trim() ||
    providerReference.length < 1 ||
    providerReference.length > 200
  ) return null;
  return { orderId, provider, providerReference };
}

export async function handlePaymentWebhook(
  request: Request,
  environment: PaymentWebhookEnvironment,
  fetcher: PaymentWebhookFetch = fetch,
): Promise<Response> {
  if (
    !environment.webhookSecret ||
    !environment.supabaseUrl ||
    !environment.serviceRoleKey
  ) return jsonResponse({ error: "NOT_CONFIGURED" }, 503);
  if (request.method !== "POST") {
    return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);
  }

  const suppliedSecret = request.headers.get("x-mofu-webhook-secret") ?? "";
  if (!await secretsMatch(suppliedSecret, environment.webhookSecret)) {
    return jsonResponse({ error: "UNAUTHORIZED" }, 401);
  }

  let rawBody: string;
  let parsedBody: unknown;
  try {
    rawBody = await request.text();
    if (rawBody.length > 4096) throw new Error("payload too large");
    parsedBody = JSON.parse(rawBody) as unknown;
  } catch {
    return jsonResponse({ error: "INVALID_PAYLOAD" }, 400);
  }
  const confirmation = exactConfirmation(parsedBody);
  if (!confirmation) return jsonResponse({ error: "INVALID_PAYLOAD" }, 400);

  let endpoint: string;
  try {
    const baseUrl = new URL(environment.supabaseUrl);
    if (baseUrl.protocol !== "https:" && baseUrl.hostname !== "127.0.0.1" && baseUrl.hostname !== "localhost") {
      throw new Error("invalid Supabase URL");
    }
    endpoint = new URL("/rest/v1/rpc/confirm_payment_order", baseUrl).toString();
  } catch {
    return jsonResponse({ error: "NOT_CONFIGURED" }, 503);
  }

  let confirmationResponse: Response;
  try {
    confirmationResponse = await fetcher(endpoint, {
      method: "POST",
      headers: {
        apikey: environment.serviceRoleKey,
        authorization: `Bearer ${environment.serviceRoleKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        p_order_id: confirmation.orderId,
        p_provider: confirmation.provider,
        p_provider_reference: confirmation.providerReference,
      }),
    });
  } catch {
    return jsonResponse({ error: "CONFIRMATION_FAILED" }, 502);
  }
  if (!confirmationResponse.ok) {
    return jsonResponse({ error: "CONFIRMATION_FAILED" }, 502);
  }
  return jsonResponse({ ok: true }, 200);
}
