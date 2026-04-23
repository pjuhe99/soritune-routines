import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "solid" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, string> = {
  solid:
    "bg-brand-primary text-text-inverse rounded-md hover:bg-brand-primary-hover active:bg-brand-primary-active",
  secondary:
    "bg-surface text-text-primary border border-border-strong rounded-md hover:bg-bg-subtle",
  ghost:
    "bg-transparent text-text-primary hover:bg-bg-subtle rounded-md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "solid", fullWidth, className = "", children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={`px-6 py-3 text-[15px] font-medium tracking-[-0.01em] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
          fullWidth ? "w-full" : ""
        } ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
