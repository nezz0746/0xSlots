import type { ReactNode } from "react";
import { UserMenu } from "@/components/user-menu";

/**
 * Full-bleed by default.
 *
 * The header used to centre itself in a `max-w-6xl` column, which on a wide
 * screen left a gutter on each side ON TOP of the 16rem the sidebar already
 * takes — so the usable band kept shrinking as the window grew. Pass
 * `maxWidth` only where a reading measure genuinely helps, such as prose.
 */
export function PageHeader({
  children,
  maxWidth,
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="border-b bg-muted/50">
      <div
        className={`${maxWidth ? `${maxWidth} mx-auto` : "w-full"} px-3 md:px-5 py-2 md:py-3`}
      >
        <div className="flex items-center justify-between gap-4">
          {/* The page's own header content keeps its left/right split. */}
          <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
            {children}
          </div>
          {/* Desktop only. Below md the wallet stays in the top nav, which is
              also where the logo lives on small screens. */}
          <div className="hidden md:block">
            <UserMenu />
          </div>
        </div>
      </div>
    </div>
  );
}
