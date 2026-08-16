import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ZODIACS } from "@/lib/eto/zodiac";
import { ZODIAC_IDS } from "@/lib/eto/types";

import { ZodiacAvatar } from "./zodiac-avatar";

describe("ZodiacAvatar", () => {
  it.each(ZODIAC_IDS)("uses the catalog asset path for %s", (zodiacId) => {
    render(<ZodiacAvatar zodiacId={zodiacId} nickname="みーちゃん" />);

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      ZODIACS[zodiacId].assetPath,
    );
  });

  it("combines the nickname and Japanese zodiac name into a meaningful alt", () => {
    render(<ZodiacAvatar zodiacId="dragon" nickname="みーちゃん" />);

    expect(
      screen.getByRole("img", { name: "みーちゃんのたつ" }),
    ).toBeInTheDocument();
  });

  it.each(["sm", "md", "lg"] as const)("exposes the %s size", (size) => {
    render(<ZodiacAvatar zodiacId="rabbit" nickname="そら" size={size} />);

    expect(screen.getByTestId("zodiac-avatar")).toHaveAttribute(
      "data-size",
      size,
    );
  });

  it("exposes the selected state", () => {
    render(<ZodiacAvatar zodiacId="tiger" nickname="りん" selected />);

    expect(screen.getByTestId("zodiac-avatar")).toHaveAttribute(
      "data-selected",
      "true",
    );
  });

  it("replaces a failed image with one accessible text fallback", () => {
    render(<ZodiacAvatar zodiacId="sheep" nickname="はな" />);

    fireEvent.error(screen.getByRole("img"));

    expect(
      screen.getByRole("img", { name: "はなのひつじ" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("ひつじ")).toHaveLength(1);
  });

  it("tries the next catalog asset after a failed zodiac is replaced", () => {
    const { rerender } = render(
      <ZodiacAvatar zodiacId="sheep" nickname="はな" />,
    );

    fireEvent.error(screen.getByRole("img", { name: "はなのひつじ" }));
    rerender(<ZodiacAvatar zodiacId="dog" nickname="るな" />);

    expect(screen.getByRole("img", { name: "るなのいぬ" })).toHaveAttribute(
      "src",
      "/zodiac/dog.png",
    );
  });
});
