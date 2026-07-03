import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent py-0.5 font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        info: "border border-inspection-info/25 bg-inspection-info-bg text-inspection-info [a]:hover:bg-inspection-info-bg/80",
        success:
          "border border-inspection-success/25 bg-inspection-success-bg text-inspection-success [a]:hover:bg-inspection-success-bg/80",
        warning:
          "border border-inspection-warning/25 bg-inspection-warning-bg text-inspection-warning [a]:hover:bg-inspection-warning-bg/80",
        handover:
          "border border-inspection-handover/25 bg-inspection-handover-bg text-inspection-handover [a]:hover:bg-inspection-handover-bg/80",
        indigo:
          "border border-inspection-indigo/25 bg-inspection-indigo-bg text-inspection-indigo [a]:hover:bg-inspection-indigo-bg/80",
        neutral:
          "border border-inspection-neutral/20 bg-inspection-neutral-bg text-inspection-neutral [a]:hover:bg-inspection-neutral-bg/80",
      },
      size: {
        default: "h-5 px-2 text-xs",
        xs: "h-4 px-1.5 text-[10px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, size }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
