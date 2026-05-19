import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-cta text-cta-foreground shadow-sm hover:bg-cta/90 hover:shadow-md hover:-translate-y-px active:translate-y-0 disabled:hover:translate-y-0 disabled:hover:bg-cta disabled:hover:shadow-sm transition-all duration-200 ease-out",
  secondary:
    "border border-border bg-card text-foreground shadow-sm hover:border-primary/25 hover:bg-background hover:shadow-md disabled:hover:shadow-sm transition-all duration-200 ease-out",
  ghost: "text-muted-foreground hover:bg-background hover:text-foreground transition-colors duration-200",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 hover:shadow-md disabled:hover:bg-red-600 transition-all duration-200",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "rounded-[12px] px-3.5 py-2 text-sm font-medium",
  md: "rounded-[12px] px-5 py-2.5 text-sm font-semibold",
};

/** Use on `<Link>` for primary/secondary styles that match `<Button>`. */
export function buttonClasses(
  variant: NonNullable<ButtonProps["variant"]> = "primary",
  size: NonNullable<ButtonProps["size"]> = "md",
) {
  return cn(
    "inline-flex items-center justify-center",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    variants[variant],
    sizes[size],
  );
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
