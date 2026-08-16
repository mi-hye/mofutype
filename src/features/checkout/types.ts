export interface PaymentInput {
  groupId: string;
  memberA: string;
  memberB: string;
}

export type PaymentMethod = "paypay" | "card";

export interface PaymentRequest extends PaymentInput {
  method: PaymentMethod;
}

export type PaymentStartResult =
  | { status: "confirmed" }
  | { status: "redirect"; checkoutUrl: string };

export interface PaymentProvider {
  start(input: PaymentRequest): Promise<PaymentStartResult>;
}
