import type { PaymentInput, PaymentProvider, PaymentResult } from "./types";

interface UnlockRepository {
  unlockPair(groupId: string, memberA: string, memberB: string): Promise<unknown>;
}

export class MockPaymentProvider implements PaymentProvider {
  constructor(private readonly repository: UnlockRepository) {}

  async unlock(input: PaymentInput): Promise<PaymentResult> {
    await this.repository.unlockPair(input.groupId, input.memberA, input.memberB);
    return { status: "unlocked" };
  }
}
