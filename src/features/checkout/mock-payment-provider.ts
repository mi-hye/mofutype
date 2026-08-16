import type { PaymentProvider, PaymentRequest, PaymentStartResult } from "./types";

interface UnlockRepository {
  createPaymentOrder(
    groupId: string,
    memberA: string,
    memberB: string,
    method: PaymentRequest["method"],
  ): Promise<unknown>;
  unlockPair(groupId: string, memberA: string, memberB: string): Promise<unknown>;
}

export class MockPaymentProvider implements PaymentProvider {
  constructor(private readonly repository: UnlockRepository) {}

  async start(input: PaymentRequest): Promise<PaymentStartResult> {
    await this.repository.createPaymentOrder(
      input.groupId,
      input.memberA,
      input.memberB,
      input.method,
    );
    await this.repository.unlockPair(input.groupId, input.memberA, input.memberB);
    return { status: "confirmed" };
  }
}
