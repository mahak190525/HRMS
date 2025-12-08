import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface CollapsibleProps {
  children: React.ReactNode
  defaultOpen?: boolean
  trigger: React.ReactNode
  className?: string
}

export function Collapsible({ 
  children, 
  defaultOpen = false, 
  trigger,
  className 
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen)

  return (
    <div className={cn("border rounded-lg overflow-hidden w-full max-w-full", className)}>
      <Button
        type="button"
        variant="ghost"
        className="w-full justify-between p-4 h-auto hover:bg-muted/50 items-start gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex-1 text-left min-w-0">{trigger}</div>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-200 flex-shrink-0 mt-0.5",
            isOpen && "transform rotate-180"
          )}
        />
      </Button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200 ease-in-out",
          isOpen ? "max-h-[10000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="p-4 pt-0">{children}</div>
      </div>
    </div>
  )
}

