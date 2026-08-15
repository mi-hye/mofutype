import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GroupRepositoryError } from "@/lib/supabase/group-repository";
import { SupabaseConfigurationError } from "@/lib/supabase/browser";
import { CreateGroupForm, CREATE_DRAFT_KEY } from "./create-group-form";

const token = "b".repeat(64);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("グループ名"), "  なかまたち  ");
  await user.type(screen.getByLabelText("ニックネーム"), "  もふ  ");
  fireEvent.change(screen.getByLabelText("生年月日"), { target: { value: "2000-02-29" } });
  fireEvent.change(screen.getByLabelText("出生時刻"), { target: { value: "09:05" } });
  await user.selectOptions(screen.getByLabelText("MBTI"), "ENFP");
}

describe("CreateGroupForm", () => {
  beforeEach(() => sessionStorage.clear());

  it("derives locally, sends only safe normalized data, clears draft and navigates", async () => {
    const user = userEvent.setup();
    const createGroup = vi.fn(async () => ({ groupId: "g1", memberId: "m1", inviteToken: token }));
    const navigate = vi.fn();
    render(<CreateGroupForm repositoryFactory={() => ({ createGroup } as never)} navigate={navigate} />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "グループを作成" }));

    await waitFor(() => expect(createGroup).toHaveBeenCalledOnce());
    expect(createGroup).toHaveBeenCalledWith({
      name: "なかまたち",
      nickname: "もふ",
      profile: {
        version: 1,
        animalId: expect.any(String),
        animalGroup: expect.any(String),
        mbti: "ENFP",
        calculationMode: "date-time",
      },
    });
    expect(JSON.stringify(createGroup.mock.calls)).not.toMatch(/2000-02-29|09:05|birth/i);
    expect(navigate).toHaveBeenCalledWith(`/g/${token}`);
    expect(sessionStorage.getItem(CREATE_DRAFT_KEY)).toBeNull();
  });

  it("shows required Japanese validation messages", () => {
    render(<CreateGroupForm repositoryFactory={vi.fn()} navigate={vi.fn()} />);
    fireEvent.submit(screen.getByRole("form", { name: "グループ作成フォーム" }));
    expect(screen.getByText("グループ名を入力してください")).toBeInTheDocument();
    expect(screen.getByText("ニックネームを入力してください")).toBeInTheDocument();
    expect(screen.getByText("正しい生年月日を入力してください")).toBeInTheDocument();
    expect(screen.getByLabelText("グループ名")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("生年月日")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toContain(
      "グループ名を入力してください",
    );
  });

  it("preserves and restores a raw draft only after repository failure", async () => {
    const user = userEvent.setup();
    const error = Object.assign(new Error("secret backend message"), { code: "CREATE_FAILED" }) as GroupRepositoryError;
    const createGroup = vi.fn(async () => { throw error; });
    const view = render(<CreateGroupForm repositoryFactory={() => ({ createGroup } as never)} navigate={vi.fn()} />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "グループを作成" }));
    expect(await screen.findByText("グループを作成できませんでした。通信環境を確認して、もう一度お試しください。")).toBeInTheDocument();
    expect(screen.queryByText("secret backend message")).not.toBeInTheDocument();
    expect(sessionStorage.getItem(CREATE_DRAFT_KEY)).toContain("2000-02-29");

    view.unmount();
    render(<CreateGroupForm repositoryFactory={() => ({ createGroup } as never)} navigate={vi.fn()} />);
    expect(screen.getByLabelText("グループ名")).toHaveValue("  なかまたち  ");
    expect(screen.getByLabelText("生年月日")).toHaveValue("2000-02-29");
  });

  it("disables duplicate submission while loading", async () => {
    const user = userEvent.setup();
    let resolve!: (value: { groupId: string; memberId: string; inviteToken: string }) => void;
    const createGroup = vi.fn(() => new Promise<typeof token extends string ? { groupId: string; memberId: string; inviteToken: string } : never>((done) => { resolve = done; }));
    render(<CreateGroupForm repositoryFactory={() => ({ createGroup } as never)} navigate={vi.fn()} />);
    await fillValid(user);
    const submit = screen.getByRole("button", { name: "グループを作成" });
    await user.click(submit);
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(createGroup).toHaveBeenCalledOnce();
    resolve({ groupId: "g1", memberId: "m1", inviteToken: token });
    await waitFor(() => expect(submit).not.toBeDisabled());
  });

  it("does not persist raw data for a local derivation or post-success navigation failure", async () => {
    const user = userEvent.setup();
    const derive = vi.fn(async () => { throw new Error("local failure"); });
    const first = render(
      <CreateGroupForm
        astrologyProvider={{ derive }}
        repositoryFactory={vi.fn()}
        navigate={vi.fn()}
      />,
    );
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "グループを作成" }));
    await screen.findByRole("alert");
    expect(sessionStorage.getItem(CREATE_DRAFT_KEY)).toBeNull();

    first.unmount();
    const createGroup = vi.fn(async () => ({ groupId: "g1", memberId: "m1", inviteToken: token }));
    render(
      <CreateGroupForm
        repositoryFactory={() => ({ createGroup } as never)}
        navigate={() => { throw new Error("navigation failure"); }}
      />,
    );
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "グループを作成" }));
    await screen.findByRole("alert");
    expect(sessionStorage.getItem(CREATE_DRAFT_KEY)).toBeNull();
  });

  it("navigates and settles loading when successful draft cleanup throws", async () => {
    const user = userEvent.setup();
    const createGroup = vi.fn(async () => ({ groupId: "g1", memberId: "m1", inviteToken: token }));
    const navigate = vi.fn();
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(() => { throw new Error("storage unavailable"); }),
    } as unknown as Storage;
    render(
      <CreateGroupForm repositoryFactory={() => ({ createGroup } as never)}
        navigate={navigate} storage={storage} />,
    );
    await fillValid(user);
    const submit = screen.getByRole("button", { name: "グループを作成" });
    await user.click(submit);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(`/g/${token}`));
    await waitFor(() => expect(submit).not.toBeDisabled());
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("prioritizes the actual Supabase configuration error class", async () => {
    const user = userEvent.setup();
    render(
      <CreateGroupForm repositoryFactory={() => { throw new SupabaseConfigurationError(); }}
        navigate={vi.fn()} />,
    );
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "グループを作成" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "現在グループ作成を利用できません。設定を確認してください。",
    );
  });

  it("stops after a deferred derivation resolves following unmount", async () => {
    const user = userEvent.setup();
    const pending = deferred<Awaited<ReturnType<NonNullable<Parameters<typeof CreateGroupForm>[0]["astrologyProvider"]>["derive"]>>>();
    const createGroup = vi.fn();
    const navigate = vi.fn();
    const storage = { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() } as unknown as Storage;
    const view = render(
      <CreateGroupForm astrologyProvider={{ derive: () => pending.promise }}
        repositoryFactory={() => ({ createGroup } as never)} navigate={navigate} storage={storage} />,
    );
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "グループを作成" }));
    view.unmount();
    pending.resolve({ version: 1, animalId: "fawn", animalGroup: "MOON", mbti: "ENFP", calculationMode: "date-time" });
    await pending.promise;
    await Promise.resolve();
    expect(createGroup).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it("ignores a deferred repository failure following unmount", async () => {
    const user = userEvent.setup();
    const pending = deferred<{ groupId: string; memberId: string; inviteToken: string }>();
    const createGroup = vi.fn(() => pending.promise);
    const storage = { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() } as unknown as Storage;
    const view = render(
      <CreateGroupForm repositoryFactory={() => ({ createGroup } as never)} navigate={vi.fn()} storage={storage} />,
    );
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "グループを作成" }));
    await waitFor(() => expect(createGroup).toHaveBeenCalledOnce());
    view.unmount();
    pending.reject(new Error("offline"));
    await expect(pending.promise).rejects.toThrow("offline");
    await Promise.resolve();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it("does not navigate or clean storage when a deferred create succeeds after unmount", async () => {
    const user = userEvent.setup();
    const pending = deferred<{ groupId: string; memberId: string; inviteToken: string }>();
    const createGroup = vi.fn(() => pending.promise);
    const navigate = vi.fn();
    const storage = { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() } as unknown as Storage;
    const view = render(
      <CreateGroupForm repositoryFactory={() => ({ createGroup } as never)} navigate={navigate} storage={storage} />,
    );
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "グループを作成" }));
    await waitFor(() => expect(createGroup).toHaveBeenCalledOnce());
    view.unmount();
    pending.resolve({ groupId: "g1", memberId: "m1", inviteToken: token });
    await pending.promise;
    await Promise.resolve();
    expect(navigate).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});
