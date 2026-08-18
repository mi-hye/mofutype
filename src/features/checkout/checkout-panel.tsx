"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type {
  PaymentInput,
  PaymentMethod,
  PaymentProvider,
  PaymentStartResult,
} from "./types";

interface CheckoutPanelProps {
  pairNames: readonly [string, string];
  input: PaymentInput;
  provider: PaymentProvider;
  onSuccess(): void;
  onRedirect?(checkoutUrl: string): void;
}

function safeCheckoutUrl(result: PaymentStartResult): string | null {
  if (result.status !== "redirect") return null;
  try {
    const url = new URL(result.checkoutUrl);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function CheckoutPanel({
  pairNames,
  input,
  provider,
  onSuccess,
  onRedirect = (checkoutUrl) => window.location.assign(checkoutUrl),
}: CheckoutPanelProps) {
  const [method, setMethod] = useState<PaymentMethod>("paypay");
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
      const result = await provider.start({ ...input, method });
      if (
        !mounted.current ||
        generation.current !== submission
      ) return;
      if (result.status === "redirect") {
        const checkoutUrl = safeCheckoutUrl(result);
        if (!checkoutUrl) throw new Error("invalid payment redirect");
        onRedirect(checkoutUrl);
        return;
      }
      if (result.status !== "confirmed") throw new Error("invalid payment result");
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

      <section className="checkout-panel__summary" aria-labelledby="checkout-summary-title">
        <h2 id="checkout-summary-title">解放される内容</h2>
        <ul>
          <li>十二支・五行・陰陽・MBTIの読み解き</li>
          <li>ふたりでいるときのヒント</li>
          <li>それぞれに向けた関わり方</li>
        </ul>
        <p>このふたり1組分を解放します</p>
      </section>

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

      <div className="checkout-panel__total">
        <div>
          <span>今回のお支払い</span>
          <strong>合計 300円</strong>
        </div>
        <p>定期課金や自動更新はありません</p>
      </div>

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
      <Link href="/tokushoho">特定商取引法に基づく表記</Link>
    </section>
  );
}
