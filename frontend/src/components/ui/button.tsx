import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center font-medium transition-all duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-teal-600 hover:bg-teal-700 text-white shadow-sm hover:shadow",
        secondary: "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200",
        ghost: "bg-transparent hover:bg-slate-100 text-slate-600",
        outline: "border border-slate-200 bg-white hover:bg-slate-50 text-slate-700",
        destructive: "bg-red-500 hover:bg-red-600 text-white",
        success: "bg-emerald-500 hover:bg-emerald-600 text-white"
      },
      size: {
        default: "px-5 py-2.5 rounded-xl text-sm",
        sm: "px-3.5 py-1.5 rounded-lg text-sm",
        lg: "px-6 py-3 rounded-xl text-base",
        icon: "p-2.5 rounded-xl"
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