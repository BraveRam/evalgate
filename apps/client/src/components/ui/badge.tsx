import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-zinc-700 bg-zinc-900 text-zinc-300",
        outline: "text-foreground border-border",
        success:
          "border-zinc-700 bg-zinc-900 text-zinc-100 font-mono",
        failure:
          "border-zinc-800 bg-zinc-950 text-zinc-400 font-mono",
        warning:
          "border-zinc-700 bg-zinc-900 text-zinc-300 font-mono",
        info: "border-zinc-700 bg-zinc-900 text-zinc-300 font-mono",
        purple:
          "border-zinc-700 bg-zinc-900 text-zinc-300 font-mono",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
