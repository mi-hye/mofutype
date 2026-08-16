import type { PaymentProvider, PaymentRequest, PaymentStartResult } from "./types";

interface UnlockRepository {
  unlockPair(groupId: string, memberA: string, memberB: string): Promise<unknown>;
}

export class MockPaymentProvider implements PaymentProvider {
  constructor(private readonly repository: UnlockRepository) {}

  async start(input: PaymentRequest): Promise<PaymentStartResult> {
    await this.repository.unlockPair(input.groupId, input.memberA, input.memberB);
    return { status: "confirmed" };
  }
}
