"use client";

import { LandPlot, List, type LucideIcon, User } from "lucide-react";
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
  // Utilities is NOT here any more — it moved to `/app/utilities`. These three
  // are VIEWS OF THE SAME DATA, which is what makes them tabs: one page, one
  // set of slots, three ways to slice it. A utility is a different kind of
  // thing — an entity the protocol has, not a projection of the explorer's
  // rows — so it reads as a destination and lives in the sidebar with policies.
  //
  // A bookmarked `?section=modules` now fails `isValidSection` and falls back
  // to the default rather than 404ing, which is the right failure but does
  // silently drop the intent. Worth a redirect if those links are out there.
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
