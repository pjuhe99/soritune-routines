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
          <label className="text-[13px] font-medium text-muted-silver tracking-normal leading-[1.6]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`bg-near-black border border-white/10 rounded-lg px-4 py-3 text-[15px] text-white tracking-[-0.01px] leading-[1.6] placeholder:text-white/40 focus:border-framer-blue focus:outline-none transition-colors ${
            error ? "border-red-500" : ""
          } ${className}`}
          {...props}
        />
        {error && <span className="text-[12px] text-red-400">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";
