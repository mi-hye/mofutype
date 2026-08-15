"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Share } from "lucide-react";

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
  const [open, setOpen] = useState(false);
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

  async function runAction(action: "share" | "copy") {
    if (loading) return;
    setLoading(true);
    setMessage(null);
    setOpen(false);
    try {
      if (action === "share" && browserShare) {
        await browserShare(payload!);
        if (mounted.current) setMessage("shared");
      } else if (action === "copy" && browserClipboard) {
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
        aria-controls="group-share-actions"
        aria-expanded={open}
        title="招待リンクを共有"
        onClick={() => {
          setMessage(null);
          setOpen((value) => !value);
        }}
      >
        <Share data-testid="share-icon" aria-hidden="true" focusable="false" strokeWidth={2.4} />
      </Button>
      {open ? (
        <div id="group-share-actions" className="group-share-actions" role="group" aria-label="共有方法">
          <Button type="button" variant="ghost" size="sm" onClick={() => void runAction("copy")}>
            リンクをコピー
          </Button>
          {browserShare ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => void runAction("share")}>
              アプリで共有
            </Button>
          ) : null}
        </div>
      ) : null}
      {message === "shared" ? <p role="status">共有しました</p> : null}
      {message === "copied" ? <p role="status">招待リンクをコピーしました</p> : null}
      {message === "error" ? (
        <p role="alert">共有できませんでした。もう一度お試しください。</p>
      ) : null}
    </div>
  );
}
