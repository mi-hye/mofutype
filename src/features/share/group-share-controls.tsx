"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  createGroupSharePayload,
  createInviteUrl,
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
      <Button
        type="button"
        className="group-share-button"
        variant="secondary"
        size="sm"
        loading={loading}
        aria-label="招待リンクを共有"
        title="招待リンクを共有"
        onClick={() => void share()}
      >
        <svg data-testid="share-icon" aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <circle cx="18" cy="5" r="2.5" />
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="19" r="2.5" />
          <path d="m8.25 10.9 7.5-4.5M8.25 13.1l7.5 4.5" />
        </svg>
      </Button>
      {message === "shared" ? <p role="status">共有しました</p> : null}
      {message === "copied" ? <p role="status">招待リンクをコピーしました</p> : null}
      {message === "error" ? (
        <p role="alert">共有できませんでした。もう一度お試しください。</p>
      ) : null}
    </div>
  );
}
