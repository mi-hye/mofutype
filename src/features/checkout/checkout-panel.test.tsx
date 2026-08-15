import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MockPaymentProvider } from "./mock-payment-provider";
import { CheckoutPanel } from "./checkout-panel";
import type { PaymentProvider } from "./types";

const input = { groupId: "g1", memberA: "b", memberB: "a" };

describe("MockPaymentProvider", () => {
  it("uses the repository unlock boundary and returns only the public payment status", async () => {
    const unlockPair = vi.fn(async () => ({ id: "private-row" }));
    const provider = new MockPaymentProvider({ unlockPair });

    await expect(provider.unlock(input)).resolves.toEqual({ status: "unlocked" });
    expect(unlockPair).toHaveBeenCalledWith("g1", "b", "a");
  });
});

describe("CheckoutPanel", () => {
  it("clearly identifies the mock charge, amount and payment choices", () => {
    render(
      <CheckoutPanel
        pairNames={["あお", "もも"]}
        input={input}
        provider={{ unlock: vi.fn() }}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "関係レポートを解放" })).toBeInTheDocument();
    expect(screen.getByText("300円")).toBeInTheDocument();
    expect(screen.getByText("これはモック決済です。実際の請求は発生しません。")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "PayPay（モック）" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "カード（モック）" })).toBeInTheDocument();
  });

  it("unlocks once and reports success", async () => {
    const user = userEvent.setup();
    const unlock = vi.fn(async () => ({ status: "unlocked" as const }));
    const onSuccess = vi.fn();
    render(
      <CheckoutPanel
        pairNames={["あお", "もも"]}
        input={input}
        provider={{ unlock }}
        onSuccess={onSuccess}
      />,
    );

    await user.click(screen.getByRole("button", { name: "モック決済を完了" }));
    expect(unlock).toHaveBeenCalledOnce();
    expect(unlock).toHaveBeenCalledWith(input);
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("keeps the report locked on failure and allows a safe retry", async () => {
    const user = userEvent.setup();
    const unlock = vi.fn()
      .mockRejectedValueOnce(new Error("private provider details"))
      .mockResolvedValueOnce({ status: "unlocked" as const });
    const onSuccess = vi.fn();
    render(
      <CheckoutPanel
        pairNames={["あお", "もも"]}
        input={input}
        provider={{ unlock } as PaymentProvider}
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
    expect(unlock).toHaveBeenCalledTimes(2);
  });

  it("does not notify after unmounting during payment", async () => {
    const user = userEvent.setup();
    let resolve!: (value: { status: "unlocked" }) => void;
    const unlock = vi.fn(() => new Promise<{ status: "unlocked" }>((done) => { resolve = done; }));
    const onSuccess = vi.fn();
    const view = render(
      <CheckoutPanel
        pairNames={["あお", "もも"]}
        input={input}
        provider={{ unlock }}
        onSuccess={onSuccess}
      />,
    );

    await user.click(screen.getByRole("button", { name: "モック決済を完了" }));
    view.unmount();
    await act(async () => resolve({ status: "unlocked" }));
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("does not offer a second payment when returning to the report fails", async () => {
    const user = userEvent.setup();
    const unlock = vi.fn(async () => ({ status: "unlocked" as const }));
    render(
      <CheckoutPanel
        pairNames={["あお", "もも"]}
        input={input}
        provider={{ unlock }}
        onSuccess={() => { throw new Error("navigation failed"); }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "モック決済を完了" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "解放は完了しました。グループの関係ページを開き直してください。",
    );
    expect(unlock).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "もう一度試す" })).not.toBeInTheDocument();
  });
});
