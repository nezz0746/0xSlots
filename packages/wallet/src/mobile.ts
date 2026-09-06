"use client";

import { useEffect, useState } from "react";

/**
 * Whether this is a phone or a tablet.
 *
 * It decides how a wallet is reached, not how the page is laid out, so it asks
 * about the device rather than the width of the window. A wallet on a phone is
 * an app that has to be opened by URL scheme; the same wallet on a laptop is an
 * extension that announces itself. A narrow window on a laptop is still a
 * laptop, and treating it as a phone would offer to open apps that are not
 * there.
 *
 * userAgentData answers directly where it exists, which is every Chromium
 * browser. Safari does not have it, so the user agent string stands in, plus
 * the touch check that catches an iPad: iPadOS calls itself Macintosh and only
 * gives itself away by reporting more than one touch point.
 */
export function onMobile(): boolean {
  if (typeof navigator === "undefined") return false;

  const hints = navigator as Navigator & {
    userAgentData?: { mobile?: boolean };
  };
  if (typeof hints.userAgentData?.mobile === "boolean")
    return hints.userAgentData.mobile;

  if (/Android|iPhone|iPod/i.test(navigator.userAgent)) return true;

  return (
    /iPad|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1
  );
}

/**
 * The same answer, safe to render with.
 *
 * False on the first render always, because the server has no navigator and a
 * first render that disagrees with the server's is a hydration error. The real
 * answer arrives immediately afterwards, which is soon enough: the wallet list
 * is a thing to be pressed, not a thing being measured.
 */
export function useOnMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => setMobile(onMobile()), []);
  return mobile;
}
