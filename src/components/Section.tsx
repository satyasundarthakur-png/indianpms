import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

/** A titled, collapsible panel used to group dashboard content. */
export function Section({
  title,
  description,
  count,
  defaultOpen = true,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center gap-2 text-left"
          aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
        >
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
          <span>
            <span className="block text-xl font-semibold">
              {title}
              {count !== undefined && (
                <span className="ml-1.5 text-muted-foreground">({count})</span>
              )}
            </span>
            {description && (
              <span className="mt-0.5 block text-sm text-muted-foreground">{description}</span>
            )}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  );
}
