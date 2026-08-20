import type { PaymentProvider, PaymentRequest, PaymentStartResult } from "./types";

interface UnlockRepository {
  createPaymentOrder(
    groupId: string,
    memberA: string,
    memberB: string,
    method: PaymentRequest["method"],
  ): Promise<{ id: string }>;
}

export interface MockConfirmationClient { confirm(orderId: string): Promise<void> }

function browserMockConfirmationClient(): MockConfirmationClient {
  return {
    async confirm(orderId) {
      const { createSupabaseBrowserClient } = await import("@/lib/supabase/browser");
      const result = await createSupabaseBrowserClient().functions.invoke(
        "local-mock-payment-confirm",
        { body: { orderId } },
      );
      if (result.error) throw new Error("Mock confirmation unavailable");
    },
  };
}

export class MockPaymentProvider implements PaymentProvider {
  constructor(
    private readonly repository: UnlockRepository,
    private readonly confirmation: MockConfirmationClient = browserMockConfirmationClient(),
  ) {}

  async start(input: PaymentRequest): Promise<PaymentStartResult> {
    const order = await this.repository.createPaymentOrder(
      input.groupId,
      input.memberA,
      input.memberB,
      input.method,
    );
    await this.confirmation.confirm(order.id);
    return { status: "confirmed" };
  }
}
