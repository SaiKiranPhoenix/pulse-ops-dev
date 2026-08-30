import { Slot, Slottable } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly asChild?: boolean;
  readonly variant?: ButtonVariant;
  readonly icon?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:bg-primary/80 active:scale-[0.98]",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70 active:scale-[0.98]",
  outline:
    "border border-input bg-background text-foreground hover:bg-accent hover:border-border/80 active:scale-[0.98]",
  ghost: "text-foreground/80 hover:bg-accent hover:text-foreground active:scale-[0.98]",
  danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:scale-[0.98]",
};

export function Button({
  asChild = false,
  className,
  disabled,
  icon,
  children,
  variant = "primary",
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(
        "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-3.5 text-base font-medium sm:h-9 sm:text-sm",
        "transition-all duration-150 ease-spring",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:pointer-events-none disabled:opacity-40",
        variantClasses[variant],
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {icon}
      <Slottable>{children}</Slottable>
    </Component>
  );
}
