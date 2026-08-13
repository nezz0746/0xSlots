import type { ReactNode } from "react";

/**
 * The page's own header, rendered in the content flow.
 *
 * Deliberately not a bar: no fill, and the rule sits inside the horizontal
 * padding so it lines up with the tables and cards below it. When this had a
 * muted full-bleed background and carried the wallet, it read as app chrome —
 * a second navbar — and the title and stats inside it read as chrome too. They
 * are the page's content, so they should look like it. The wallet went back to
 * the navbar above, which is now the only thing in the layout that is chrome.
 *
 * Full-bleed by default: the sidebar already takes 16rem, so centring the
 * header in a `max-w-6xl` column shrank the usable band further as the window
 * grew. Pass `maxWidth` on pages whose content is itself centred, so the header
 * and the content share one left edge.
 */
export function PageHeader({
  children,
  maxWidth,
}: {
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    <header
      className={`${maxWidth ? `${maxWidth} mx-auto` : "w-full"} px-3 md:px-5 pt-3 md:pt-5`}
    >
      {/* Wraps rather than squeezes: several pages put a title block on the
          left and actions on the right, and narrow viewports can't hold both. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b pb-3 md:pb-4">
        {children}
      </div>
    </header>
  );
}
