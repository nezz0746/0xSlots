// deno-fmt-ignore-file
// biome-ignore format: generated types do not need formatting
// prettier-ignore
import type { PathsForPages } from 'waku/router'

// prettier-ignore
type Page =
  | { path: '/concepts/collectives'; render: 'static' }
  | { path: '/concepts/modules'; render: 'static' }
  | { path: '/concepts/occupancy'; render: 'static' }
  | { path: '/concepts/slots'; render: 'static' }
  | { path: '/deployments'; render: 'static' }
  | { path: '/getting-started'; render: 'static' }
  | { path: '/'; render: 'static' }
  | { path: '/indexer'; render: 'static' }
  | { path: '/modules/adland'; render: 'static' }
  | { path: '/overview'; render: 'static' }
  | { path: '/reference/factory'; render: 'static' }
  | { path: '/reference/modules'; render: 'static' }
  | { path: '/reference/policies'; render: 'static' }
  | { path: '/reference/slot'; render: 'static' }
  | { path: '/sdk/client'; render: 'static' }
  | { path: '/sdk/react'; render: 'static' }
  | { path: '/vision'; render: 'static' }

// prettier-ignore
declare module 'waku/router' {
  interface RouteConfig {
    paths: PathsForPages<Page>
  }
  interface CreatePagesConfig {
    pages: Page
  }
}
