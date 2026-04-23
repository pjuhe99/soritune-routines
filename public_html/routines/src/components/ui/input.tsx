import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="text-[13px] font-medium text-text-secondary tracking-[-0.01em]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`bg-surface border border-border-default rounded-md px-4 py-3 text-[15px] text-text-primary tracking-[-0.01em] leading-[1.5] placeholder:text-text-tertiary focus:border-brand-primary focus:outline-none transition-colors ${
            error ? "border-danger" : ""
          } ${className}`}
          {...props}
        />
        {error && <span className="text-[12px] text-danger">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";
