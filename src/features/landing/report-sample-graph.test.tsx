import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReportSampleGraph } from "./report-sample-graph";

describe("ReportSampleGraph", () => {
  it("shows the selected pair inside a wider group relationship graph", () => {
    const { container } = render(<ReportSampleGraph />);

    expect(screen.getByRole("figure", { name: "AさんとBさんのサンプル" })).toBeInTheDocument();
    expect(screen.getByText("A × B")).toBeInTheDocument();
    expect(screen.getByText("INFJ・うさぎ")).toBeInTheDocument();
    expect(screen.getByText("ENTP・うま")).toBeInTheDocument();
    expect(screen.getByText("ISFJ・ひつじ")).toBeInTheDocument();
    expect(screen.getByText("INTJ・いぬ")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-selected="true"]')).toHaveLength(2);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
