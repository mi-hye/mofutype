import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";
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

describe("Card", () => {
  it.each(["default", "accent", "subtle"] as const)(
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

  it("uses an accessible Japanese label", () => {
    render(<StatusBanner status="offline" />);
    expect(screen.getByRole("alert", { name: "オフライン" })).toBeInTheDocument();
  });
});
