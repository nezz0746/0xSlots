import { AlertCircle } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { type CreateSlotFormValues, createSlotSchema } from "../schema";
import { type SectionId, sectionsForFields } from "../sections";

/**
 * Which sections are blocking submission, and a way to get to them.
 *
 * The wizard used to guarantee this for free: you could not reach the last
 * step without passing through the others, so a disabled Create button was
 * self-explanatory. On one scroll you can walk straight past a broken field
 * and find the button dead with no stated reason.
 *
 * Parses the schema rather than reading `formState.errors`: react-hook-form
 * only commits an error once its field has been touched, so `errors` is empty
 * on a form nobody has filled in — precisely when this is most needed. The
 * schema knows what is missing whether or not anyone has typed yet.
 */
export function ErrorSummary({ onJump }: { onJump: (id: SectionId) => void }) {
  const form = useFormContext<CreateSlotFormValues>();
  const values = form.watch();
  const result = createSlotSchema.safeParse(values);
  const sections = result.success
    ? []
    : sectionsForFields(
        result.error.issues.map((issue) => String(issue.path[0] ?? "")),
      );

  if (sections.length === 0) return null;

  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2.5 space-y-1.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
        <AlertCircle className="size-3.5 shrink-0" />
        {sections.length === 1
          ? "1 section needs attention"
          : `${sections.length} sections need attention`}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onJump(s.id)}
            className="rounded border border-destructive/30 px-1.5 py-0.5 text-[11px] text-destructive hover:bg-destructive/10 transition-colors"
          >
            {s.title}
          </button>
        ))}
      </div>
    </div>
  );
}
