"use client";

import { LandPlot, List, type LucideIcon, Puzzle, User } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export const SECTION_PARAM = "section";

export interface ExplorerSection {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const EXPLORER_SECTIONS: ExplorerSection[] = [
  { id: "slots", label: "Slots", icon: LandPlot },
  { id: "recipients", label: "Recipients", icon: User },
  // Label says Utilities, id stays `modules`. The id is URL-facing
  // (`?section=modules`) and keys `SECTION_CONTENT` on the explorer, so
  // renaming it would break every shared link for a word change. The contracts
  // did NOT make the same trade for the metadata getter: `moduleURI()` and
  // `policyURI()` became one `IModuleMetadata.metadataURI()`, accepting a wire
  // break because every deployed value was empty and the utilities are
  // upgradeable proxies. A URL is not, which is why this id stays.
  { id: "modules", label: "Utilities", icon: Puzzle },
  { id: "events", label: "Events", icon: List },
];

const DEFAULT_SECTION = EXPLORER_SECTIONS[0].id;

interface ExplorerSectionContextValue {
  section: string;
  setSection: (id: string) => void;
}

const Ctx = createContext<ExplorerSectionContextValue | null>(null);

function isKnownSection(id: string | null): id is string {
  return id !== null && EXPLORER_SECTIONS.some((s) => s.id === id);
}

/**
 * Resolve synchronously on first render — same reasoning as the chain context:
 * this tree never renders on the server, so there is no hydration pass to
 * mismatch, and resolving up front avoids a flash of the wrong section.
 */
function resolveInitialSection(): string {
  if (typeof window === "undefined") return DEFAULT_SECTION;
  const param = new URLSearchParams(window.location.search).get(SECTION_PARAM);
  return isKnownSection(param) ? param : DEFAULT_SECTION;
}

/** Reflect the section in the address bar without triggering a navigation. */
function writeSectionToUrl(id: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.searchParams.get(SECTION_PARAM) === id) return;
  url.searchParams.set(SECTION_PARAM, id);
  window.history.replaceState(null, "", url);
}

/**
 * Which explorer section is showing. Lifted out of the page so the desktop
 * sidebar and the mobile tab strip drive the same state, and kept in the URL so
 * it survives a reload.
 */
export function ExplorerSectionProvider({ children }: { children: ReactNode }) {
  const initial = useRef(resolveInitialSection());
  const [section, setSectionState] = useState(initial.current);

  const setSection = useCallback((id: string) => {
    if (!isKnownSection(id)) return;
    setSectionState(id);
    writeSectionToUrl(id);
  }, []);

  const value = useMemo(() => ({ section, setSection }), [section, setSection]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useExplorerSection(): ExplorerSectionContextValue {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error(
      "useExplorerSection must be used within ExplorerSectionProvider",
    );
  return ctx;
}
