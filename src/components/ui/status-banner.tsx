import type { HTMLAttributes } from "react";

export type ConnectionStatus =
  | "connecting"
  | "reconnecting"
  | "offline"
  | "error"
  | "success";

const STATUS_CONTENT: Record<
  ConnectionStatus,
  { label: string; message: string; urgent: boolean }
> = {
  connecting: {
    label: "接続中",
    message: "グループに接続しています",
    urgent: false,
  },
  reconnecting: {
    label: "再接続中",
    message: "もう一度つないでいます",
    urgent: false,
  },
  offline: {
    label: "オフライン",
    message: "通信環境を確認してください",
    urgent: true,
  },
  error: {
    label: "エラー",
    message: "接続できませんでした",
    urgent: true,
  },
  success: {
    label: "接続完了",
    message: "グループにつながりました",
    urgent: false,
  },
};

export interface StatusBannerProps extends HTMLAttributes<HTMLDivElement> {
  status: ConnectionStatus;
}
export function StatusBanner({
  status,
  className = "",
  children,
  ...props
}: StatusBannerProps) {
  const content = STATUS_CONTENT[status];

  return (
    <div
      className={`status-banner ${className}`.trim()}
      data-status={status}
      role={content.urgent ? "alert" : "status"}
      aria-label={content.label}
      {...props}
    >
      <span className="status-banner__mark" aria-hidden="true" />
      <span>
        <strong>{content.label}</strong>
        <span>{children ?? content.message}</span>
      </span>
    </div>
  );
}
