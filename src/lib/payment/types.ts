export const PAYMENT_METHODS = ["paypay", "card"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
