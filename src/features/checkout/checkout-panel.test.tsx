import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MockPaymentProvider } from "./mock-payment-provider";
import { CheckoutPanel } from "./checkout-panel";
import type { PaymentProvider } from "./types";

const input = { groupId: "g1", memberA: "b", memberB: "a" };

describe("MockPaymentProvider", () => {
  it("uses the repository unlock boundary only for the explicit test provider", async () => {
    const createPaymentOrder = vi.fn(async () => ({ id: "order-1" }));
    const unlockPair = vi.fn(async () => ({ id: "private-row" }));
    const provider = new MockPaymentProvider({ createPaymentOrder, unlockPair });

    await expect(provider.start({ ...input, method: "paypay" })).resolves.toEqual({
      status: "confirmed",
    });
    expect(createPaymentOrder).toHaveBeenCalledWith("g1", "b", "a", "paypay");
    expect(unlockPair).toHaveBeenCalledWith("g1", "b", "a");
  });
});

describe("CheckoutPanel", () => {
  it("clearly identifies the mock charge, amount and payment choices", () => {
    render(
      <CheckoutPanel
        pairNames={["あお", "もも"]}
        input={input}
        provider={{ start: vi.fn() }}
        onSuccess={vi.fn()}
        returnHref="/g/token/relation/a%3Ab"
      />,
    );

    expect(screen.getByRole("heading", { name: "関係レポートを解放" })).toBeInTheDocument();
    expect(screen.getByText("300円")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "解放される内容" })).toBeInTheDocument();
    expect(screen.getByText("十二支・五行・陰陽・MBTIの読み解き")).toBeInTheDocument();
    expect(screen.getByText("ふたりでいるときのヒント")).toBeInTheDocument();
    expect(screen.getByText("このふたり1組分を解放します")).toBeInTheDocument();
    expect(screen.getByText("今回のお支払い")).toBeInTheDocument();
    expect(screen.getByText("合計 300円")).toBeInTheDocument();
    expect(screen.getByText("定期課金や自動更新はありません")).toBeInTheDocument();
    expect(screen.getByText("決済完了後、このふたりの関係レポートをすぐに表示します")).toBeInTheDocument();
    expect(screen.getByText("これはモック決済です。実際の請求は発生しません。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "関係ページに戻る" })).toHaveAttribute(
      "href",
      "/g/token/relation/a%3Ab",
    );
    expect(screen.getByRole("radio", { name: "PayPay（モック）" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "カード（モック）" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "特定商取引法に基づく表記" })).toHaveAttribute(
      "href",
      "/tokushoho",
    );
  });

  it("unlocks once and reports success", async () => {
    const user = userEvent.setup();
    const start = vi.fn(async () => ({ status: "confirmed" as const }));
    const onSuccess = vi.fn();
    render(
      <CheckoutPanel
        pairNames={["あお", "もも"]}
        input={input}
        provider={{ start }}
        onSuccess={onSuccess}
      />,
    );

    await user.click(screen.getByRole("button", { name: "モック決済を完了" }));
    expect(start).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledWith({ ...input, method: "paypay" });
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("passes the selected card method to the payment boundary", async () => {
    const user = userEvent.setup();
    const start = vi.fn(async () => ({ status: "confirmed" as const }));
    render(
      <CheckoutPanel
        pairNames={["あお", "もも"]}
        input={input}
        provider={{ start }}
        onSuccess={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("radio", { name: "カード（モック）" }));
    await user.click(screen.getByRole("button", { name: "モック決済を完了" }));
    expect(start).toHaveBeenCalledWith({ ...input, method: "card" });
  });

  it("hands an external checkout URL to navigation without unlocking locally", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    const onRedirect = vi.fn();
    render(
      <CheckoutPanel
        pairNames={["あお", "もも"]}
        input={input}
        provider={{
          start: vi.fn(async () => ({
            status: "redirect" as const,
            checkoutUrl: "https://checkout.example/session-1",
          })),
        }}
        onRedirect={onRedirect}
        onSuccess={onSuccess}
      />,
    );

    await user.click(screen.getByRole("button", { name: "モック決済を完了" }));
    expect(onRedirect).toHaveBeenCalledWith("https://checkout.example/session-1");
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /モック決済を完了.*処理中/ })).toBeDisabled();
  });

  it("rejects unsafe checkout redirects without exposing provider details", async () => {
    const user = userEvent.setup();
    const onRedirect = vi.fn();
    render(
      <CheckoutPanel
        pairNames={["あお", "もも"]}
        input={input}
        provider={{
          start: vi.fn(async () => ({
            status: "redirect" as const,
            checkoutUrl: "javascript:private-provider-value",
          })),
        }}
        onRedirect={onRedirect}
        onSuccess={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "モック決済を完了" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "解放できませんでした。通信環境を確認して、もう一度お試しください。",
    );
    expect(screen.queryByText(/private-provider-value/)).not.toBeInTheDocument();
    expect(onRedirect).not.toHaveBeenCalled();
  });

  it("keeps the report locked on failure and allows a safe retry", async () => {
    const user = userEvent.setup();
    const start = vi.fn()
      .mockRejectedValueOnce(new Error("private provider details"))
      .mockResolvedValueOnce({ status: "confirmed" as const });
    const onSuccess = vi.fn();
    render(
      <CheckoutPanel
        pairNames={["あお", "もも"]}
        input={input}
        provider={{ start } as PaymentProvider}
        onSuccess={onSuccess}
      />,
    );

    await user.click(screen.getByRole("button", { name: "モック決済を完了" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "解放できませんでした。通信環境を確認して、もう一度お試しください。",
    );
    expect(screen.queryByText(/private provider details/)).not.toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "もう一度試す" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(start).toHaveBeenCalledTimes(2);
  });

  it("does not notify after unmounting during payment", async () => {
    const user = userEvent.setup();
    let resolve!: (value: { status: "confirmed" }) => void;
    const start = vi.fn(() => new Promise<{ status: "confirmed" }>((done) => { resolve = done; }));
    const onSuccess = vi.fn();
    const view = render(
      <CheckoutPanel
        pairNames={["あお", "もも"]}
        input={input}
        provider={{ start }}
        onSuccess={onSuccess}
      />,
    );

    await user.click(screen.getByRole("button", { name: "モック決済を完了" }));
    view.unmount();
    await act(async () => resolve({ status: "confirmed" }));
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("does not offer a second payment when returning to the report fails", async () => {
    const user = userEvent.setup();
    const start = vi.fn(async () => ({ status: "confirmed" as const }));
    render(
      <CheckoutPanel
        pairNames={["あお", "もも"]}
        input={input}
        provider={{ start }}
        onSuccess={() => { throw new Error("navigation failed"); }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "モック決済を完了" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "解放は完了しました。グループの関係ページを開き直してください。",
    );
    expect(start).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "もう一度試す" })).not.toBeInTheDocument();
  });
});
