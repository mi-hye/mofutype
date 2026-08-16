import { forwardRef, type HTMLAttributes } from "react";

export type CapsuleProps = HTMLAttributes<HTMLSpanElement>;

export const Capsule = forwardRef<HTMLSpanElement, CapsuleProps>(function Capsule(
  { className = "", ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      className={`ui-capsule ${className}`.trim()}
      {...props}
    />
  );
});
