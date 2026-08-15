import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LandingRelationshipPreview } from "./landing-relationship-preview";

describe("LandingRelationshipPreview", () => {
  it("activates only the relationship lines connected to a selected animal", () => {
    const { container } = render(<LandingRelationshipPreview />);
    const entjNode = screen.getByRole("button", { name: "ENTJ とらを選択" });

    expect(entjNode).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelectorAll('line[data-active="true"]')).toHaveLength(0);

    fireEvent.click(entjNode);

    expect(entjNode).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelectorAll('line[data-active="true"]')).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent(
      "ENTJにつながる関係線を強調しました。",
    );
  });

  it("lets the selected node be toggled off", () => {
    const { container } = render(<LandingRelationshipPreview />);
    const isfjNode = screen.getByRole("button", { name: "ISFJ うさぎを選択" });

    fireEvent.click(isfjNode);
    fireEvent.click(isfjNode);

    expect(isfjNode).toHaveAttribute("aria-pressed", "false");
    expect(container.querySelectorAll('line[data-active="true"]')).toHaveLength(0);
  });
});
