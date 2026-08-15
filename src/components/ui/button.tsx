import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className = "",
    disabled = false,
    loading = false,
    size = "md",
    variant = "primary",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      {...props}
      className={`ui-button ${className}`.trim()}
      data-size={size}
      data-variant={variant}
      role="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      <span>{children}</span>
      {loading ? (
        <span className="ui-button__loading" role="status" aria-label="処理中">
          <span className="ui-button__spinner" aria-hidden="true" />
        </span>
      ) : null}
    </button>
  );
});
