export interface EximbayPaymentRequest {
  fgkey: string;
  payment: {
    transaction_type: "PAYMENT";
    order_id: string;
    currency: "JPY";
    amount: "100";
    lang: "JP";
    payment_method: "P354" | "P000";
  };
  merchant: { mid: string };
  buyer: { name: string; email: string };
  url: { return_url: string; status_url: string };
  other_param: { param1: string };
}

export interface EximbayPaymentSession {
  sdkUrl: string;
  request: EximbayPaymentRequest;
}
