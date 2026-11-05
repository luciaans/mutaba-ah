import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonStyles = cva("inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#70a68c] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: {
      primary: "bg-[#0d5c45] text-white hover:bg-[#0a4d3a]",
      secondary: "border border-[#dfe7e1] bg-white text-[#40564a] hover:bg-[#f5f8f5]",
      ghost: "text-[#536158] hover:bg-[#f2f5f2]",
      danger: "bg-[#b94d42] text-white hover:bg-[#9f3d34]",
    },
    size: { default: "px-4", sm: "min-h-10 rounded-lg px-3 text-xs", lg: "min-h-12 px-5" },
  },
  defaultVariants: { variant: "primary", size: "default" },
});

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonStyles>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonStyles({ variant, size }), className)} {...props} />;
}
