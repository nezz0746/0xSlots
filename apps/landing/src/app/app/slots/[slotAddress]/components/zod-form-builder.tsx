"use client";

import type { Control, FieldValues } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Get the type name of a Zod schema field.
 * Works with both Zod v3 (_def.typeName) and Zod v4 (_zod.def.type).
 */
function getTypeName(field: any): string {
  // Zod v3
  if (field?._def?.typeName) return field._def.typeName;
  // Zod v4
  if (field?._zod?.def?.type) return field._zod.def.type;
  return "unknown";
}

/**
 * Unwrap optional / effects / default wrappers to get the base type.
 * Version-agnostic: works with Zod v3 and v4 schemas.
 */
function unwrapField(field: any): { base: any; optional: boolean } {
  let optional = false;
  let current = field;
  while (current) {
    const typeName = getTypeName(current);
    if (typeName === "ZodOptional" || typeName === "optional") {
      optional = true;
      // v3: .unwrap(), v4: ._zod.def.innerType
      current =
        current.unwrap?.() ??
        current._zod?.def?.innerType ??
        current._def?.innerType;
    } else if (typeName === "ZodEffects" || typeName === "effects") {
      current =
        current.innerType?.() ??
        current._zod?.def?.innerType ??
        current._def?.schema;
    } else if (typeName === "ZodDefault" || typeName === "default") {
      current =
        current.removeDefault?.() ??
        current._zod?.def?.innerType ??
        current._def?.innerType;
    } else {
      break;
    }
  }
  return { base: current, optional };
}

/**
 * Humanize a camelCase key into a readable label.
 * e.g. "chainId" → "Chain ID", "url" → "URL", "fid" → "FID"
 */
function humanizeKey(key: string): string {
  const acronyms: Record<string, string> = {
    url: "URL",
    uri: "URI",
    id: "ID",
    fid: "FID",
  };
  if (acronyms[key.toLowerCase()]) return acronyms[key.toLowerCase()];

  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/^./, (s) => s.toUpperCase());
}

/**
 * Get the shape (field map) from a ZodObject schema.
 * Works with both Zod v3 and v4.
 */
function getShape(schema: any): Record<string, any> {
  // Zod v3: schema.shape is the shape directly
  if (schema.shape && typeof schema.shape === "object") {
    return schema.shape;
  }
  // Zod v4: schema._zod.def.shape
  if (schema._zod?.def?.shape) {
    return schema._zod.def.shape;
  }
  return {};
}

function isNumberType(typeName: string): boolean {
  return typeName === "ZodNumber" || typeName === "number";
}

interface ZodFormBuilderProps<T extends FieldValues> {
  schema: any;
  control: Control<T>;
}

export function ZodFormBuilder<T extends FieldValues>({
  schema,
  control,
}: ZodFormBuilderProps<T>) {
  const shape = getShape(schema);

  return (
    <div className="space-y-3">
      {Object.entries(shape).map(([key, fieldSchema]) => {
        const { base, optional } = unwrapField(fieldSchema);
        const typeName = getTypeName(base);
        const isNumber = isNumberType(typeName);

        const choices = (
          fieldSchema as { choices?: { label: string; value: unknown }[] }
        ).choices;

        return (
          <FormField
            key={key}
            control={control}
            name={key as any}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">
                  {humanizeKey(key)}
                  {optional && (
                    <span className="text-muted-foreground ml-1">
                      (optional)
                    </span>
                  )}
                </FormLabel>
                <FormControl>
                  {choices ? (
                    <Select
                      onValueChange={(v) =>
                        field.onChange(isNumber ? Number(v) : v)
                      }
                      value={
                        field.value != null ? String(field.value) : undefined
                      }
                    >
                      <SelectTrigger className="text-xs w-full">
                        <SelectValue placeholder={humanizeKey(key)} />
                      </SelectTrigger>
                      <SelectContent className="w-full">
                        {choices.map((c) => (
                          <SelectItem
                            key={String(c.value)}
                            value={String(c.value)}
                            className="text-xs"
                          >
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : isNumber ? (
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder={humanizeKey(key)}
                      className="text-xs"
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value.replace(",", ".");
                        field.onChange(val === "" ? undefined : Number(val));
                      }}
                    />
                  ) : (
                    <Input
                      type="text"
                      placeholder={humanizeKey(key)}
                      className="text-xs"
                      {...field}
                      value={field.value ?? ""}
                    />
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      })}
    </div>
  );
}
