import type { ReactNode } from "react";
import type { SectionMeta } from "../sections";

/**
 * One titled block of the create form.
 *
 * `scroll-mt-20` clears the app shell's sticky top nav, so a jump from the
 * summary card lands on the heading rather than under it.
 */
export function FormSection({
  meta,
  children,
}: {
  meta: SectionMeta;
  children: ReactNode;
}) {
  const Icon = meta.icon;

  return (
    <section
      id={`section-${meta.id}`}
      aria-labelledby={`section-${meta.id}-title`}
      className="scroll-mt-20 border-t first:border-t-0 px-3 md:px-6 py-5 md:py-6"
    >
      <div className="flex items-start gap-3 mb-4">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${meta.tint}`}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <h2
            id={`section-${meta.id}-title`}
            className="text-sm font-semibold leading-tight"
          >
            {meta.title}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {meta.description}
          </p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
