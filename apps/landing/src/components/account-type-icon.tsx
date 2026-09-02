import type { AccountType } from "@/lib/indexer";
import { File, FileUser, Split, User } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const CONFIG: Record<
  AccountType,
  { Icon: typeof User; label: string; className?: string }
> = {
  EOA: { Icon: User, label: "EOA" },
  CONTRACT: { Icon: File, label: "Contract" },
  SPLIT: { Icon: Split, label: "Split", className: "rotate-90" },
  DELEGATED: { Icon: FileUser, label: "Delegated" },
};

export function AccountTypeIcon({
  type,
  className = "h-3.5 w-3.5",
}: {
  type: AccountType;
  className?: string;
}) {
  const { Icon, label, className: iconClassName } = CONFIG[type] ?? CONFIG.EOA;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <Icon
            className={`inline-block text-muted-foreground ${className} ${iconClassName ?? ""}`}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
