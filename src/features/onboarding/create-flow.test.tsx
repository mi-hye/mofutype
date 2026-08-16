import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreateGroupForm, CREATE_DRAFT_KEY } from "./create-group-form";

const token = "c".repeat(64);

describe("combined group creation", () => {
  beforeEach(() => sessionStorage.clear());

  it("collects the group and creator profile together and creates after submission", async () => {
    const user = userEvent.setup();
    const createGroup = vi.fn(async () => ({ groupId: "g1", memberId: "m1", inviteToken: token }));
    const navigateToGroup = vi.fn();
    render(<CreateGroupForm repositoryFactory={() => ({ createGroup } as never)}
      navigate={navigateToGroup} />);

    expect(screen.getByRole("form", { name: "グループ作成フォーム" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("グループ名"), "  放課後クラブ  ");
    await user.type(screen.getByLabelText("ニックネーム"), "もふ");
    fireEvent.change(screen.getByLabelText("生年月日"), { target: { value: "2000-02-29" } });
    fireEvent.change(screen.getByLabelText("出生時刻"), { target: { value: "09:05" } });
    await user.selectOptions(screen.getByLabelText("MBTI"), "ENFP");
    await user.click(screen.getByRole("button", { name: "グループを作成" }));

    await waitFor(() => expect(createGroup).toHaveBeenCalledOnce());
    expect(createGroup).toHaveBeenCalledWith(expect.objectContaining({ name: "放課後クラブ" }));
    expect(navigateToGroup).toHaveBeenCalledWith(`/g/${token}`);
    expect(sessionStorage.getItem(CREATE_DRAFT_KEY)).toBeNull();
  });

  it("does not restore obsolete privacy-sensitive drafts", () => {
    sessionStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify({ groupName: "残さない" }));
    render(<CreateGroupForm repositoryFactory={vi.fn()} navigate={vi.fn()} />);

    expect(screen.getByRole("form", { name: "グループ作成フォーム" })).toBeInTheDocument();
    expect(screen.getByLabelText("グループ名")).toHaveValue("");
    expect(sessionStorage.getItem(CREATE_DRAFT_KEY)).toBeNull();
  });

  it("validates the combined form before creating or routing", async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const createGroup = vi.fn();
    render(<CreateGroupForm repositoryFactory={() => ({ createGroup } as never)} navigate={navigate} />);

    await user.click(screen.getByRole("button", { name: "グループを作成" }));

    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("グループ名を入力してください");
    expect(createGroup).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(CREATE_DRAFT_KEY)).toBeNull();
  });
});
