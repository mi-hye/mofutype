"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    if (!open) return;
    firstActionRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

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
    if (!resolvedOrigin) return <p className="group-share-feedback" role="status">共有リンクを準備しています</p>;
    return <p className="group-share-feedback" role="alert">共有リンクを作成できません。</p>;
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
    triggerRef.current?.focus();
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
        ref={triggerRef}
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
        <svg data-testid="share-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24">
          <path d="M12 3v12m0-12 4 4m-4-4L8 7M5 11v8h14v-8" />
        </svg>
      </Button>
      {open && typeof document !== "undefined" ? createPortal(
        <div className="group-share-backdrop" onMouseDown={(event) => {
          if (event.target !== event.currentTarget) return;
          setOpen(false);
          triggerRef.current?.focus();
        }}>
          <section id="group-share-actions" className="group-share-actions"
            role="dialog" aria-modal="true" aria-labelledby="group-share-title">
            <header>
              <h2 id="group-share-title">共有方法</h2>
              <button type="button" className="group-share-actions__close"
                aria-label="共有メニューを閉じる" onClick={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}>
                <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </button>
            </header>
            <Button ref={firstActionRef} type="button" variant="ghost" size="sm"
              onClick={() => void runAction("copy")}>
              リンクをコピー
            </Button>
            {browserShare ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => void runAction("share")}>
                アプリで共有
              </Button>
            ) : null}
          </section>
        </div>,
        document.body,
      ) : null}
      {message === "shared" ? <p className="group-share-feedback" role="status">共有しました</p> : null}
      {message === "copied" ? <p className="group-share-feedback" role="status">招待リンクをコピーしました</p> : null}
      {message === "error" ? (
        <p className="group-share-feedback" role="alert">共有できませんでした。もう一度お試しください。</p>
      ) : null}
    </div>
  );
}
