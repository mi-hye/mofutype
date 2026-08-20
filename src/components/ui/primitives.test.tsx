import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button, ButtonLink } from "./button";
import { Capsule } from "./capsule";
import { Card } from "./card";
import { StatusBanner } from "./status-banner";

describe("Button", () => {
  it("forwards native props and disables interaction", () => {
    render(
      <Button type="submit" disabled aria-label="保存する">
        保存
      </Button>,
    );

    expect(screen.getByRole("button", { name: "保存する" })).toBeDisabled();
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("announces loading and becomes disabled", () => {
    render(<Button loading>保存</Button>);

    expect(screen.getByRole("button", { name: "保存 処理中" })).toBeDisabled();
    expect(screen.getByRole("status", { name: "処理中" })).toBeInTheDocument();
  });

  it("protects loading semantics from conflicting native props", () => {
    render(
      <Button loading disabled={false} aria-busy={false} role="link">
        保存
      </Button>,
    );

    const button = screen.getByRole("button", { name: "保存 処理中" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it.each(["primary", "secondary", "ghost"] as const)(
    "exposes the %s variant",
    (variant) => {
      render(<Button variant={variant}>{variant}</Button>);
      expect(screen.getByRole("button")).toHaveAttribute(
        "data-variant",
        variant,
      );
    },
  );
});

describe("ButtonLink", () => {
  it("uses the shared button contract for navigation", () => {
    render(<ButtonLink href="/next" size="lg">次へ</ButtonLink>);

    const link = screen.getByRole("link", { name: "次へ" });
    expect(link).toHaveClass("ui-button");
    expect(link).toHaveAttribute("data-size", "lg");
    expect(link).toHaveAttribute("data-variant", "primary");
  });
});

describe("Capsule", () => {
  it("renders the shared capsule contract", () => {
    render(<Capsule>#MBTI</Capsule>);

    expect(screen.getByText("#MBTI")).toHaveClass("ui-capsule");
  });
});

describe("Card", () => {
  it("forwards its ref", () => {
    const ref = createRef<HTMLDivElement>();
    render(<Card ref={ref}>カード</Card>);

    expect(ref.current).toBe(screen.getByText("カード"));
  });

  it.each([
    "default",
    "accent",
    "subtle",
    "cream",
    "pink",
    "mint",
    "violet",
  ] as const)(
    "exposes the %s variant",
    (variant) => {
      render(<Card variant={variant}>カード</Card>);
      expect(screen.getByText("カード")).toHaveAttribute(
        "data-variant",
        variant,
      );
    },
  );
});

describe("StatusBanner", () => {
  it("forwards its ref", () => {
    const ref = createRef<HTMLDivElement>();
    render(<StatusBanner ref={ref} status="success" />);

    expect(ref.current).toBe(screen.getByRole("status"));
  });

  it("protects its role and accessible output from conflicting props", () => {
    render(
      <StatusBanner
        status="error"
        role="status"
        aria-label="上書き"
        aria-labelledby="missing-label"
        aria-describedby="missing-description"
      />,
    );

    const banner = screen.getByRole("alert", { name: "エラー" });
    expect(banner).toHaveAccessibleDescription("接続できませんでした");
    expect(banner).not.toHaveAttribute("aria-label");
  });

  it.each(["connecting", "reconnecting", "success"] as const)(
    "uses a polite status role for %s",
    (status) => {
      render(<StatusBanner status={status} />);
      expect(screen.getByRole("status")).toBeInTheDocument();
    },
  );

  it.each(["offline", "error"] as const)(
    "uses an alert role for %s",
    (status) => {
      render(<StatusBanner status={status} />);
      expect(screen.getByRole("alert")).toBeInTheDocument();
    },
  );

  it.each([
    ["connecting", "status", "接続中", "グループに接続しています"],
    ["reconnecting", "status", "再接続中", "もう一度つないでいます"],
    ["offline", "alert", "オフライン", "通信環境を確認してください"],
    ["error", "alert", "エラー", "接続できませんでした"],
    ["success", "status", "接続完了", "グループにつながりました"],
  ] as const)(
    "announces the %s Japanese label and guidance",
    (status, role, label, message) => {
      render(<StatusBanner status={status} />);
      const banner = screen.getByRole(role, { name: label });

      expect(banner).toHaveAccessibleDescription(message);
    },
  );
});
