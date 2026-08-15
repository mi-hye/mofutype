import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ANIMALS, ANIMAL_ORDER } from "@/lib/astrology/animals";

import { AnimalAvatar } from "./animal-avatar";

describe("AnimalAvatar", () => {
  it.each(ANIMAL_ORDER)("uses the catalog asset path for %s", (animalId) => {
    render(<AnimalAvatar animalId={animalId} nickname="みーちゃん" />);

    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      ANIMALS[animalId].asset,
    );
  });

  it("combines the nickname and Japanese animal name into a meaningful alt", () => {
    render(<AnimalAvatar animalId="black-panther" nickname="みーちゃん" />);

    expect(
      screen.getByRole("img", { name: "みーちゃんの黒ひょう" }),
    ).toBeInTheDocument();
  });

  it.each(["sm", "md", "lg"] as const)("exposes the %s size", (size) => {
    render(<AnimalAvatar animalId="koala" nickname="そら" size={size} />);

    expect(screen.getByTestId("animal-avatar")).toHaveAttribute(
      "data-size",
      size,
    );
  });

  it("exposes the selected state", () => {
    render(<AnimalAvatar animalId="lion" nickname="りん" selected />);

    expect(screen.getByTestId("animal-avatar")).toHaveAttribute(
      "data-selected",
      "true",
    );
  });

  it("replaces a failed image with one accessible text fallback", () => {
    render(<AnimalAvatar animalId="elephant" nickname="はな" />);

    fireEvent.error(screen.getByRole("img"));

    expect(
      screen.getByRole("img", { name: "はなのゾウ" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("ゾウ")).toHaveLength(1);
  });

  it("tries the next catalog asset after a failed animal is replaced", () => {
    const { rerender } = render(
      <AnimalAvatar animalId="elephant" nickname="はな" />,
    );

    fireEvent.error(screen.getByRole("img", { name: "はなのゾウ" }));
    rerender(<AnimalAvatar animalId="wolf" nickname="るな" />);

    expect(screen.getByRole("img", { name: "るなの狼" })).toHaveAttribute(
      "src",
      "/animals/wolf.svg",
    );
  });
});
