import { type ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-accent text-white",
        secondary: "border-transparent bg-muted text-foreground",
        destructive: "border-transparent bg-destructive text-white",
        success: "border-transparent bg-success text-white",
        outline: "border-border bg-transparent text-foreground",
      },
      appearance: {
        default: "",
        outline: "bg-transparent",
      },
    },
    compoundVariants: [
      {
        variant: "success",
        appearance: "outline",
        class: "border-success/40 text-success",
      },
      {
        variant: "destructive",
        appearance: "outline",
        class: "border-destructive/40 text-destructive",
      },
    ],
    defaultVariants: {
      variant: "default",
      appearance: "default",
    },
  },
);

export interface BadgeProps
  extends ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, appearance, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, appearance, className }))} {...props} />
  );
}

export { Badge, badgeVariants };
