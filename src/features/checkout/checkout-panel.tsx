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
  returnHref?: string;
  mode?: "mock" | "live";
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
  returnHref,
  mode = "mock",
}: CheckoutPanelProps) {
  const [method, setMethod] = useState<PaymentMethod>("paypay");
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState(false);
  const [returnFailure, setReturnFailure] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState("");
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
      const result = await provider.start({
        ...input,
        method,
        ...(mode === "live" ? { buyerName: pairNames[0], buyerEmail } : {}),
      });
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
      if (result.status === "launched") return;
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
      {returnHref ? (
        <Link className="checkout-panel__back" href={returnHref}>
          関係ページに戻る
        </Link>
      ) : null}
      <p className="checkout-panel__notice">
        {mode === "mock"
          ? "これはモック決済です。実際の請求は発生しません。"
          : "1組300円の買い切りです。追加料金や自動更新はありません。"}
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
            name="payment-method"
            onChange={() => setMethod("paypay")}
            type="radio"
          />
          {mode === "mock" ? "PayPay（モック）" : "PayPay"}
        </label>
        <label>
          <input
            checked={method === "card"}
            name="payment-method"
            onChange={() => setMethod("card")}
            type="radio"
          />
          {mode === "mock" ? "カード（モック）" : "カード"}
        </label>
      </fieldset>

      <div className="checkout-panel__total">
        <div>
          <span>今回のお支払い</span>
          <strong>合計 300円</strong>
        </div>
        <p>定期課金や自動更新はありません</p>
      </div>

      <p className="checkout-panel__aftercare">
        決済完了後、このふたりの関係レポートをすぐに表示します
      </p>

      {mode === "live" ? (
        <label>
          決済確認メール
          <input
            autoComplete="email"
            disabled={loading}
            inputMode="email"
            maxLength={254}
            onChange={(event) => setBuyerEmail(event.target.value)}
            required
            type="email"
            value={buyerEmail}
          />
        </label>
      ) : null}

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
        <Button
          type="button"
          size="lg"
          loading={loading}
          disabled={mode === "live" && !buyerEmail}
          onClick={() => void submit()}
        >
          {failure ? "もう一度試す" : mode === "mock" ? "モック決済を完了" : "300円で解放する"}
        </Button>
      )}
      <Link href="/tokushoho">特定商取引法に基づく表記</Link>
    </section>
  );
}
