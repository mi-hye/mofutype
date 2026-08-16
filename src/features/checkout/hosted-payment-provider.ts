import type { PaymentMethod } from "@/lib/payment/types";
import type { PaymentProvider, PaymentRequest, PaymentStartResult } from "./types";

interface PaymentOrderRepository {
  createPaymentOrder(
    groupId: string,
    memberA: string,
    memberB: string,
    method: PaymentMethod,
  ): Promise<{
    id: string;
    method: PaymentMethod;
    status: "pending" | "paid";
  }>;
}

interface CheckoutSessionClient {
  createCheckoutSession(input: {
    orderId: string;
    method: PaymentMethod;
  }): Promise<{ checkoutUrl: string }>;
}

export class HostedPaymentProvider implements PaymentProvider {
  constructor(
    private readonly repository: PaymentOrderRepository,
    private readonly sessionClient: CheckoutSessionClient,
  ) {}

  async start(input: PaymentRequest): Promise<PaymentStartResult> {
    const order = await this.repository.createPaymentOrder(
      input.groupId,
      input.memberA,
      input.memberB,
      input.method,
    );
    if (order.status === "paid") return { status: "confirmed" };

    const session = await this.sessionClient.createCheckoutSession({
      orderId: order.id,
      method: order.method,
    });
    return { status: "redirect", checkoutUrl: session.checkoutUrl };
  }
}
