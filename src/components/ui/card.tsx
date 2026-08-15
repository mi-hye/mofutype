import type { HTMLAttributes } from "react";

type CardVariant = "default" | "accent" | "subtle";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}
export function Card({
  className = "",
  variant = "default",
  ...props
}: CardProps) {
  return (
    <div
      className={`ui-card ${className}`.trim()}
      data-variant={variant}
      {...props}
    />
  );
}
