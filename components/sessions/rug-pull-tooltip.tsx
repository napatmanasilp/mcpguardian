"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export const RUG_PULL_DESCRIPTION =
  "Rug pull: the MCP server attempted to exfiltrate data or execute unauthorized actions, causing the session to be terminated."

export function RugPullTooltip({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent>
          <p>{RUG_PULL_DESCRIPTION}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
