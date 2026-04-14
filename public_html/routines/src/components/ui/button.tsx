import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "solid" | "frosted" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, string> = {
  solid: "bg-white text-black rounded-pill hover:opacity-90",
  frosted:
    "bg-frosted-white text-white rounded-pill-sm hover:bg-subtle-white",
  ghost:
    "bg-transparent text-white hover:bg-frosted-white rounded-pill-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "solid", fullWidth, className = "", children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={`px-6 py-3 text-[15px] font-medium tracking-[-0.15px] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
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
