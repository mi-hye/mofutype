"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PaymentInput, PaymentProvider } from "./types";

interface CheckoutPanelProps {
  pairNames: readonly [string, string];
  input: PaymentInput;
  provider: PaymentProvider;
  onSuccess(): void;
}

export function CheckoutPanel({
  pairNames,
  input,
  provider,
  onSuccess,
}: CheckoutPanelProps) {
  const [method, setMethod] = useState<"paypay" | "card">("paypay");
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState(false);
  const [returnFailure, setReturnFailure] = useState(false);
  const mounted = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
    };
  }, []);

  async function submit() {
    if (loading) return;
    setLoading(true);
    setFailure(false);
    setReturnFailure(false);
    const submission = ++generation.current;
    try {
      const result = await provider.unlock(input);
      if (
        !mounted.current ||
        generation.current !== submission
      ) return;
      if (result.status !== "unlocked") throw new Error("invalid payment result");
    } catch {
      if (mounted.current && generation.current === submission) {
        setFailure(true);
        setLoading(false);
      }
      return;
    }
    if (!mounted.current || generation.current !== submission) return;
    setLoading(false);
    try {
      onSuccess();
    } catch {
      setReturnFailure(true);
    }
  }

  return (
    <section className="checkout-panel" aria-labelledby="checkout-title">
      <p className="checkout-panel__notice">
        これはモック決済です。実際の請求は発生しません。
      </p>
      <h1 id="checkout-title">関係レポートを解放</h1>
      <p>{pairNames[0]} × {pairNames[1]}</p>
      <p className="checkout-panel__price">300円</p>

      <fieldset disabled={loading}>
        <legend>支払い方法</legend>
        <label>
          <input
            checked={method === "paypay"}
            name="mock-payment-method"
            onChange={() => setMethod("paypay")}
            type="radio"
          />
          PayPay（モック）
        </label>
        <label>
          <input
            checked={method === "card"}
            name="mock-payment-method"
            onChange={() => setMethod("card")}
            type="radio"
          />
          カード（モック）
        </label>
      </fieldset>

      {failure ? (
        <p role="alert">
          解放できませんでした。通信環境を確認して、もう一度お試しください。
        </p>
      ) : null}
      {returnFailure ? (
        <p role="status">
          解放は完了しました。グループの関係ページを開き直してください。
        </p>
      ) : (
        <Button type="button" size="lg" loading={loading} onClick={() => void submit()}>
          {failure ? "もう一度試す" : "モック決済を完了"}
        </Button>
      )}
    </section>
  );
}
