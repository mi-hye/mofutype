import { forwardRef, type HTMLAttributes } from "react";

type CardVariant =
  | "default"
  | "accent"
  | "subtle"
  | "cream"
  | "pink"
  | "mint"
  | "violet";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className = "", variant = "default", ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={`ui-card ${className}`.trim()}
      data-variant={variant}
      {...props}
    />
  );
});
