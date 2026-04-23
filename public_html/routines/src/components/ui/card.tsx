import { HTMLAttributes, forwardRef } from "react";

type Variant = "surface" | "subtle";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

const variantStyles: Record<Variant, string> = {
  surface: "bg-surface border border-border-default rounded-lg",
  subtle: "bg-bg-subtle border border-border-default rounded-lg",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "surface", className = "", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`p-6 ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
