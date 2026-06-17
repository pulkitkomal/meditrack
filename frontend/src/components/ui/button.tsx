import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center font-semibold transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-teal-600 hover:bg-teal-700 text-white shadow-glass hover:shadow-glass-hover rounded-glass",
        secondary: "glass-surface hover:bg-glass-light-heavy text-slate-700 rounded-glass",
        ghost: "bg-transparent hover:bg-glass-tint text-slate-600 rounded-glass",
        outline: "border border-slate-200 bg-glass-light backdrop-blur-[8px] hover:bg-glass-tint text-slate-700 rounded-glass",
        destructive: "bg-red-500 hover:bg-red-600 text-white rounded-glass",
        success: "bg-emerald-500 hover:bg-emerald-600 text-white rounded-glass"
      },
      size: {
        default: "px-5 py-2.5 text-sm",
        sm: "px-3.5 py-1.5 rounded-glass-sm text-sm",
        lg: "px-6 py-3 rounded-glass text-base",
        icon: "p-2.5 rounded-glass"
      }
    },
    defaultVariants: { variant: "default", size: "default" }
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
})
Button.displayName = "Button"

export { Button, buttonVariants }
