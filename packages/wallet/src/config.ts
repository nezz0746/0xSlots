import { createStorage } from "@wagmi/core";

/** Public relay identifier already used by the explorer. Override per deployment. */
export const DEFAULT_WALLETCONNECT_PROJECT_ID =
  "8d4685db15de09d142d3650e08c90f79";

/** Explicit namespaces prevent separate app/miniapp configs sharing connector IDs. */
export function walletStorage(key: string) {
  return createStorage({
    key,
    storage: {
      getItem(name) {
        try {
          return window.localStorage.getItem(name);
        } catch {
          return null;
        }
      },
      setItem(name, value) {
        try {
          window.localStorage.setItem(name, value);
        } catch {
          /* unavailable storage */
        }
      },
      removeItem(name) {
        try {
          window.localStorage.removeItem(name);
        } catch {
          /* unavailable storage */
        }
      },
    },
  });
}
