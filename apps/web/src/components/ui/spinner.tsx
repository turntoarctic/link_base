import { Loader2Icon } from "lucide-react"
import { cn } from "@/lib/cn"

/** shadcn/ui Spinner（官方 new-york 版） */
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label="loading"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
