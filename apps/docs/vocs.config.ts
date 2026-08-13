// vocs 2.x: `defineConfig` moved to the `vocs/config` subpath. The bare `vocs`
// entry pulls in the React component tree, whose `~icons` imports are Vite
// virtual modules that Node cannot resolve while loading this file.
import { defineConfig } from "vocs/config";

export default defineConfig({
  // vocs 2.x resolves pages as rootDir/srcDir/pagesDir and defaults srcDir to
  // "src" (the Waku convention it is now built on). This project's pages have
  // always lived in docs/pages.
  srcDir: "docs",

  // vocs 2.x defaults to `dynamic`, which emits an SSR bundle and zero HTML.
  // Railway serves this site as static files, so that deployed green and then
  // 502'd on every request. `full-static` prerenders every route back to HTML.
  renderStrategy: "full-static",

  title: "0xSlots",
  description: "Collectively Owned Slots Protocol",
  ogImageUrl:
    "https://vocs.dev/api/og?logo=%logo&title=%title&description=%description",
  iconUrl: "/logo.png",

  // 2.x moved this to the top level; it used to be `theme.accentColor`. The old
  // shape type-errors but the build tolerated it, so the accent silently fell
  // back to the default. `light-dark()` gives the dark scheme a visible accent —
  // a flat #000000 disappears against a dark background.
  accentColor: "light-dark(#000000, #ffffff)",

  // `font` was removed in 2.x — there is no config-level font option any more.
  // Override the CSS variables in a custom stylesheet if the default is wrong.
  topNav: [
    { text: "Overview", link: "/overview" },
    { text: "SDK", link: "/sdk/client" },
    {
      text: "GitHub",
      link: "https://github.com/nezz0746/0xSlots",
    },
    {
      text: "Telegram",
      link: "https://t.me/+AQ3SdkC0SCM4NTdk",
    },
  ],
  // Concepts explain WHY and reference states WHAT. The old single
  // "Architecture" page tried to do both at once and became unreadable.
  sidebar: [
    {
      text: "Introduction",
      items: [
        { text: "Overview", link: "/overview" },
        { text: "Vision", link: "/vision" },
        { text: "Getting Started", link: "/getting-started" },
      ],
    },
    {
      text: "Concepts",
      items: [
        { text: "How a slot works", link: "/concepts/slots" },
        { text: "Occupancy", link: "/concepts/occupancy" },
        { text: "Utility modules", link: "/concepts/modules" },
        { text: "Collectives", link: "/concepts/collectives" },
      ],
    },
    {
      text: "Contract reference",
      items: [
        { text: "SlotFactory", link: "/reference/factory" },
        { text: "Slot", link: "/reference/slot" },
        { text: "Occupancy policies", link: "/reference/policies" },
        { text: "Utility modules", link: "/reference/modules" },
      ],
    },
    {
      text: "SDK",
      items: [
        { text: "SlotsClient", link: "/sdk/client" },
        { text: "React Hooks", link: "/sdk/react" },
      ],
    },
    {
      text: "Deployments",
      link: "/deployments",
    },
    {
      text: "Indexer",
      link: "/indexer",
    },
  ],
});
