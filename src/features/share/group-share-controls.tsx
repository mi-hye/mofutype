"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  createGroupSharePayload,
  createInviteUrl,
  createXIntent,
  type GroupSharePayload,
} from "@/lib/share/x-intent";

type ShareApi = (payload: GroupSharePayload) => Promise<void>;
type ClipboardApi = (text: string) => Promise<void>;

const subscribeToNoopStore = () => () => undefined;
const browserOriginSnapshot = () => window.location.origin;
const serverOriginSnapshot = () => "";

interface GroupShareControlsProps {
  groupName: string;
  memberCount: number;
  inviteToken: string;
  origin?: string;
  shareApi?: ShareApi | null;
  writeClipboard?: ClipboardApi | null;
}

export function GroupShareControls({
  groupName,
  memberCount,
  inviteToken,
  origin,
  shareApi,
  writeClipboard,
}: GroupShareControlsProps) {
  const [message, setMessage] = useState<"shared" | "copied" | "error" | null>(null);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(false);
  const browserOrigin = useSyncExternalStore(
    subscribeToNoopStore,
    browserOriginSnapshot,
    serverOriginSnapshot,
  );
  const resolvedOrigin = origin ?? browserOrigin;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const payload = useMemo(() => {
    try {
      if (!resolvedOrigin) return null;
      return createGroupSharePayload(
        groupName,
        createInviteUrl(resolvedOrigin, inviteToken, { groupName, memberCount }),
      );
    } catch {
      return null;
    }
  }, [groupName, inviteToken, memberCount, resolvedOrigin]);

  if (!payload) {
    if (!resolvedOrigin) return <p role="status">共有リンクを準備しています</p>;
    return <p role="alert">共有リンクを作成できません。</p>;
  }

  const browserShare: ShareApi | null = shareApi === undefined
    ? (typeof navigator !== "undefined" && typeof navigator.share === "function"
      ? (data) => navigator.share(data)
      : null)
    : shareApi;
  const browserClipboard: ClipboardApi | null = writeClipboard === undefined
    ? (typeof navigator !== "undefined" && navigator.clipboard
      ? (text) => navigator.clipboard.writeText(text)
      : null)
    : writeClipboard;

  async function share() {
    if (loading) return;
    setLoading(true);
    setMessage(null);
    try {
      if (browserShare) {
        await browserShare(payload!);
        if (mounted.current) setMessage("shared");
      } else if (browserClipboard) {
        await browserClipboard(payload!.url);
        if (mounted.current) setMessage("copied");
      } else {
        throw new Error("share unavailable");
      }
    } catch {
      if (mounted.current) setMessage("error");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  return (
    <div className="group-share-controls">
      <Button type="button" variant="secondary" loading={loading} onClick={() => void share()}>
        招待リンクを共有
      </Button>
      <a
        className="ui-button"
        data-size="sm"
        data-variant="ghost"
        href={createXIntent(payload.text, payload.url)}
        rel="noopener noreferrer"
        target="_blank"
      >
        Xで共有
      </a>
      {message === "shared" ? <p role="status">共有しました</p> : null}
      {message === "copied" ? <p role="status">招待リンクをコピーしました</p> : null}
      {message === "error" ? (
        <p role="alert">共有できませんでした。もう一度お試しください。</p>
      ) : null}
    </div>
  );
}
