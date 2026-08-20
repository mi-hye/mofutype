import type { PaymentMethod } from "@/lib/payment/types";

export type { PaymentMethod } from "@/lib/payment/types";

export interface PaymentInput {
  groupId: string;
  memberA: string;
  memberB: string;
}

export interface PaymentRequest extends PaymentInput {
  method: PaymentMethod;
  buyerName?: string;
  buyerEmail?: string;
}

export type PaymentStartResult =
  | { status: "confirmed" }
  | { status: "launched" }
  | { status: "redirect"; checkoutUrl: string };

export interface PaymentProvider {
  start(input: PaymentRequest): Promise<PaymentStartResult>;
}
