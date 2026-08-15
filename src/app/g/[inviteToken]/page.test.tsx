import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import GroupPage from "./page";

describe("GroupPage", () => {
  it("awaits Next dynamic params and passes the token into the gate", async () => {
    const view = await GroupPage({ params: Promise.resolve({ inviteToken: "bad-token" }) });
    render(view);
    expect(screen.getByRole("heading", { name: "招待リンクが無効です" })).toBeInTheDocument();
  });
});
