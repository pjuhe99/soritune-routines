import { HTMLAttributes, forwardRef } from "react";

type Variant = "surface" | "elevated";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

const variantStyles: Record<Variant, string> = {
  surface: "bg-near-black shadow-ring-blue rounded-xl",
  elevated: "bg-near-black shadow-elevated rounded-xl",
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
