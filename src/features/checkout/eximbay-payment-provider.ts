import type { EximbayPaymentSession } from "@/lib/payment/eximbay-types";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { PaymentProvider, PaymentRequest, PaymentStartResult } from "./types";

interface PaymentOrderRepository {
  createPaymentOrder(
    groupId: string,
    memberA: string,
    memberB: string,
    method: PaymentRequest["method"],
  ): Promise<{ id: string; status: "pending" | "paid" }>;
}

interface EximbayWindow extends Window {
  EXIMBAY?: { request_pay(request: EximbayPaymentSession["request"]): void };
}

let sdkPromise: Promise<void> | null = null;

function loadSdk(url: string, target: EximbayWindow = window): Promise<void> {
  if (target.EXIMBAY) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = target.document.createElement("script");
    script.async = true;
    script.src = url;
    script.onload = () => target.EXIMBAY ? resolve() : reject(new Error("SDK unavailable"));
    script.onerror = () => reject(new Error("SDK unavailable"));
    target.document.head.append(script);
  }).catch((error) => {
    sdkPromise = null;
    throw error;
  });
  return sdkPromise;
}

export interface EximbaySessionClient {
  create(input: {
    orderId: string;
    buyerName: string;
    buyerEmail: string;
    returnPath: string;
  }): Promise<EximbayPaymentSession>;
  launch(session: EximbayPaymentSession): Promise<void>;
}

export function createBrowserEximbaySessionClient(): EximbaySessionClient {
  return {
    async create(input) {
      const client = createSupabaseBrowserClient();
      const result = await client.functions.invoke<EximbayPaymentSession>(
        "eximbay-payment-session",
        { body: input },
      );
      if (result.error || !result.data) throw new Error("Payment session unavailable");
      return result.data;
    },
    async launch(session) {
      await loadSdk(session.sdkUrl);
      const eximbay = (window as EximbayWindow).EXIMBAY;
      if (!eximbay) throw new Error("Payment SDK unavailable");
      eximbay.request_pay(session.request);
    },
  };
}

export class EximbayPaymentProvider implements PaymentProvider {
  constructor(
    private readonly repository: PaymentOrderRepository,
    private readonly returnPath: string,
    private readonly client: EximbaySessionClient = createBrowserEximbaySessionClient(),
  ) {}

  async start(input: PaymentRequest): Promise<PaymentStartResult> {
    if (!input.buyerName || !input.buyerEmail) throw new Error("Buyer details required");
    const order = await this.repository.createPaymentOrder(
      input.groupId,
      input.memberA,
      input.memberB,
      input.method,
    );
    if (order.status === "paid") return { status: "confirmed" };
    const session = await this.client.create({
      orderId: order.id,
      buyerName: input.buyerName,
      buyerEmail: input.buyerEmail,
      returnPath: this.returnPath,
    });
    await this.client.launch(session);
    return { status: "launched" };
  }
}
