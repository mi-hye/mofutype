export interface PaymentInput {
  groupId: string;
  memberA: string;
  memberB: string;
}

export interface PaymentResult {
  status: "unlocked";
}

export interface PaymentProvider {
  unlock(input: PaymentInput): Promise<PaymentResult>;
}
