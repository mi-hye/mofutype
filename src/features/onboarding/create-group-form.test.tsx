import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DerivedEtoProfile } from "@/lib/eto/types";
import { SupabaseConfigurationError } from "@/lib/supabase/browser";
import { CREATE_DRAFT_KEY, CreateGroupForm } from "./create-group-form";

const token = "b".repeat(64);
const clock = () => new Date("2026-08-15T15:30:00.000Z");
const rawDate = "2000-02-29";
const rawTime = "09:05";
const profile: DerivedEtoProfile = {
  version: 1,
  zodiacId: "dragon",
  mbti: "ENFP",
  dayMaster: { element: "EARTH", polarity: "YANG" },
  fiveElements: { WOOD: 2, FIRE: 1, EARTH: 2, METAL: 1, WATER: 2 },
  yinYang: { YIN: 4, YANG: 4 },
  calculationMode: "date-time",
  boundaryState: "exact",
  engineVersion: "mofu-eto-four-pillars-v1",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function recordingStorage(seed?: Record<string, string>, throwOnRemove = false) {
  const values = new Map(Object.entries(seed ?? {}));
  const getItem = vi.fn(() => { throw new Error("getItem must not be called"); });
  const setItem = vi.fn(() => { throw new Error("setItem must not be called"); });
  const removeItem = vi.fn((key: string) => {
    if (throwOnRemove) throw new Error("storage unavailable");
    values.delete(key);
  });
  return {
    storage: { getItem, setItem, removeItem } as unknown as Storage,
    values,
    getItem,
    setItem,
    removeItem,
  };
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("グループ名"), "  なかまたち  ");
  await user.type(screen.getByLabelText("ニックネーム"), "  もふ  ");
  fireEvent.change(screen.getByLabelText("生年月日"), { target: { value: rawDate } });
  fireEvent.change(screen.getByLabelText("出生時刻"), { target: { value: rawTime } });
  await user.selectOptions(screen.getByLabelText("MBTI"), "ENFP");
}

function expectNoRawPersistence(recorder: ReturnType<typeof recordingStorage>) {
  expect(recorder.getItem).not.toHaveBeenCalled();
  expect(recorder.setItem).not.toHaveBeenCalled();
  expect([...recorder.values.values()].join(" ")).not.toMatch(/2000-02-29|09:05|もふ|なかまたち/);
}

describe("CreateGroupForm", () => {
  it("renders and submits when reading window.sessionStorage throws", async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    if (!descriptor) throw new Error("sessionStorage descriptor is unavailable");
    const user = userEvent.setup();
    const derive = vi.fn(async () => profile);
    const createGroup = vi.fn(async () => ({ groupId: "g1", memberId: "m1", inviteToken: token }));
    const navigate = vi.fn();
    let view: ReturnType<typeof render> | undefined;
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get() { throw new DOMException("blocked", "SecurityError"); },
    });

    try {
      view = render(
        <CreateGroupForm clock={clock} etoProvider={{ derive }}
          repositoryFactory={() => ({ createGroup } as never)} navigate={navigate} />,
      );
      await fillValid(user);
      await user.click(screen.getByRole("button", { name: "グループを作成" }));

      await waitFor(() => expect(navigate).toHaveBeenCalledWith(`/g/${token}`));
      expect(createGroup).toHaveBeenCalledOnce();
    } finally {
      view?.unmount();
      Object.defineProperty(window, "sessionStorage", descriptor);
    }
  });

  it("removes the legacy draft on mount without reading or restoring it", async () => {
    const recorder = recordingStorage({
      [CREATE_DRAFT_KEY]: JSON.stringify({ nickname: "保存した名前", birthDate: "1999-01-01" }),
    });

    render(<CreateGroupForm storage={recorder.storage} clock={clock} />);

    await waitFor(() => expect(recorder.removeItem).toHaveBeenCalledWith(CREATE_DRAFT_KEY));
    expect(screen.getByLabelText("ニックネーム")).toHaveValue("");
    expect(screen.getByLabelText("生年月日")).toHaveAttribute("max", "2026-08-16");
    expectNoRawPersistence(recorder);
  });

  it("validates without storage reads or writes", async () => {
    const recorder = recordingStorage();
    render(<CreateGroupForm storage={recorder.storage} clock={clock} repositoryFactory={vi.fn()} />);

    fireEvent.submit(screen.getByRole("form", { name: "グループ作成フォーム" }));

    expect(screen.getByText("グループ名を入力してください")).toBeInTheDocument();
    expect(screen.getByText("ニックネームを入力してください")).toBeInTheDocument();
    expect(screen.getByText("正しい生年月日を入力してください")).toBeInTheDocument();
    expectNoRawPersistence(recorder);
  });

  it("derives the new profile, submits it exactly, clears memory, then navigates", async () => {
    const user = userEvent.setup();
    const recorder = recordingStorage();
    const derive = vi.fn(async () => profile);
    const createGroup = vi.fn(async () => ({ groupId: "g1", memberId: "m1", inviteToken: token }));
    const navigate = vi.fn((path: string) => {
      expect(path).toBe(`/g/${token}`);
      expect(screen.getByLabelText("グループ名")).toHaveValue("");
      expect(screen.getByLabelText("ニックネーム")).toHaveValue("");
      expect(screen.getByLabelText("生年月日")).toHaveValue("");
      expect(screen.getByLabelText("出生時刻")).toHaveValue("");
    });
    render(
      <CreateGroupForm storage={recorder.storage} clock={clock} etoProvider={{ derive }}
        repositoryFactory={() => ({ createGroup } as never)} navigate={navigate} />,
    );
    await fillValid(user);

    await user.click(screen.getByRole("button", { name: "グループを作成" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledOnce());
    expect(derive).toHaveBeenCalledWith(
      { birthDate: rawDate, birthTime: rawTime, mbti: "ENFP" },
      "2026-08-16",
    );
    expect(createGroup).toHaveBeenCalledWith({ name: "なかまたち", nickname: "もふ", profile });
    expect(JSON.stringify(createGroup.mock.calls)).not.toMatch(/2000-02-29|09:05|birth/i);
    expectNoRawPersistence(recorder);
  });

  it.each([
    ["provider", "プロフィールを作成できませんでした。入力内容を確認してください。"],
    ["repository", "グループを作成できませんでした。通信環境を確認して、もう一度お試しください。"],
    ["navigation", "作成したグループを開けませんでした。もう一度リンクを開いてください。"],
  ])("keeps retry data only in React memory after a %s failure", async (failureAt, safeMessage) => {
    const user = userEvent.setup();
    const recorder = recordingStorage();
    const secret = `${rawDate}-${rawTime}-秘密`;
    const derive = vi.fn(async () => {
      if (failureAt === "provider") throw new Error(secret);
      return profile;
    });
    const createGroup = vi.fn(async () => {
      if (failureAt === "repository") throw Object.assign(new Error(secret), { code: "CREATE_FAILED" });
      return { groupId: "g1", memberId: "m1", inviteToken: token };
    });
    const navigate = vi.fn(() => {
      if (failureAt === "navigation") throw new Error(secret);
    });
    render(
      <CreateGroupForm storage={recorder.storage} clock={clock} etoProvider={{ derive }}
        repositoryFactory={() => ({ createGroup } as never)} navigate={navigate} />,
    );
    await fillValid(user);

    await user.click(screen.getByRole("button", { name: "グループを作成" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(safeMessage);
    expect(screen.getByRole("alert")).not.toHaveTextContent(secret);
    expect(screen.getByLabelText("生年月日")).toHaveValue(failureAt === "navigation" ? "" : rawDate);
    expect(navigate.mock.calls.flat().join(" ")).not.toMatch(/2000-02-29|09:05/);
    expectNoRawPersistence(recorder);
  });

  it("continues when best-effort legacy cleanup throws and blocks duplicate submits", async () => {
    const user = userEvent.setup();
    const recorder = recordingStorage({}, true);
    const pending = deferred<{ groupId: string; memberId: string; inviteToken: string }>();
    const createGroup = vi.fn(() => pending.promise);
    render(
      <CreateGroupForm storage={recorder.storage} clock={clock} etoProvider={{ derive: async () => profile }}
        repositoryFactory={() => ({ createGroup } as never)} navigate={vi.fn()} />,
    );
    await fillValid(user);
    const submit = screen.getByRole("button", { name: "グループを作成" });

    await user.click(submit);
    await user.click(submit);

    expect(submit).toBeDisabled();
    expect(createGroup).toHaveBeenCalledOnce();
    pending.resolve({ groupId: "g1", memberId: "m1", inviteToken: token });
    await waitFor(() => expect(submit).not.toBeDisabled());
    expectNoRawPersistence(recorder);
  });

  it("uses the configuration-safe error without exposing its cause", async () => {
    const user = userEvent.setup();
    render(<CreateGroupForm clock={clock} repositoryFactory={() => { throw new SupabaseConfigurationError(); }} navigate={vi.fn()} />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "グループを作成" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("現在グループ作成を利用できません。設定を確認してください。");
  });

  it("has no post-unmount provider, repository, storage, navigation, or state effects", async () => {
    const user = userEvent.setup();
    const recorder = recordingStorage();
    const pending = deferred<DerivedEtoProfile>();
    const createGroup = vi.fn();
    const navigate = vi.fn();
    const view = render(
      <CreateGroupForm storage={recorder.storage} clock={clock} etoProvider={{ derive: () => pending.promise }}
        repositoryFactory={() => ({ createGroup } as never)} navigate={navigate} />,
    );
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "グループを作成" }));
    await waitFor(() => expect(recorder.removeItem).toHaveBeenCalledOnce());
    view.unmount();

    pending.resolve(profile);
    await pending.promise;
    await Promise.resolve();

    expect(createGroup).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(recorder.removeItem).toHaveBeenCalledOnce();
    expectNoRawPersistence(recorder);
  });
});
