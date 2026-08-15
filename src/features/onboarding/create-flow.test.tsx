import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateGroupForm, CREATE_DRAFT_KEY } from "./create-group-form";
import { StartGroupForm } from "./start-group-form";

const token = "c".repeat(64);

describe("two-step group creation", () => {
  beforeEach(() => sessionStorage.clear());

  it("stores the group name, routes to profile input, and creates only after profile submission", async () => {
    const user = userEvent.setup();
    const navigateToProfile = vi.fn();
    const start = render(<StartGroupForm navigate={navigateToProfile} />);

    await user.type(screen.getByLabelText("グループ名"), "  放課後クラブ  ");
    await user.click(screen.getByRole("button", { name: "次へ：プロフィール入力" }));

    expect(navigateToProfile).toHaveBeenCalledWith("/create/profile");
    expect(sessionStorage.getItem(CREATE_DRAFT_KEY)).toContain("放課後クラブ");
    start.unmount();

    const createGroup = vi.fn(async () => ({ groupId: "g1", memberId: "m1", inviteToken: token }));
    const navigateToGroup = vi.fn();
    render(<CreateGroupForm profileOnly repositoryFactory={() => ({ createGroup } as never)}
      navigate={navigateToGroup} />);

    expect(screen.getByRole("form", { name: "プロフィール入力フォーム" })).toBeInTheDocument();
    expect(screen.getByLabelText("作成するグループ")).toHaveTextContent("放課後クラブ");
    expect(screen.queryByLabelText("グループ名")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("ニックネーム"), "もふ");
    fireEvent.change(screen.getByLabelText("生年月日"), { target: { value: "2000-02-29" } });
    fireEvent.change(screen.getByLabelText("出生時刻"), { target: { value: "09:05" } });
    await user.selectOptions(screen.getByLabelText("MBTI"), "ENFP");
    await user.click(screen.getByRole("button", { name: "グループを作成" }));

    await waitFor(() => expect(createGroup).toHaveBeenCalledOnce());
    expect(createGroup).toHaveBeenCalledWith(expect.objectContaining({ name: "放課後クラブ" }));
    expect(navigateToGroup).toHaveBeenCalledWith(`/g/${token}`);
  });

  it("keeps an empty profile route from exposing an unusable submit form", () => {
    render(<CreateGroupForm profileOnly repositoryFactory={vi.fn()} navigate={vi.fn()} />);

    expect(screen.queryByRole("form", { name: "プロフィール入力フォーム" })).not.toBeInTheDocument();
    expect(screen.getByText("先にグループ名を入力してください。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "グループ名を入力する" })).toHaveAttribute("href", "/#create");
  });

  it("validates the first step before storing or routing", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    render(<StartGroupForm navigate={navigate} />);

    await user.click(screen.getByRole("button", { name: "次へ：プロフィール入力" }));

    expect(screen.getByRole("alert")).toHaveTextContent("グループ名を入力してください");
    expect(navigate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(CREATE_DRAFT_KEY)).toBeNull();
  });
});
