"use client";

import { create } from "qrcode";
import { useMemo } from "react";

/**
 * A WalletConnect pairing URI as an SVG, with its own quiet zone.
 *
 * Opt-in at `@0xslots/wallet/qr`, so the encoder is only bundled by an app
 * that shows a relay QR at all. Unstyled beyond the two colours a scanner
 * needs; size it from outside.
 */
export default function QrCode({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const { modules } = useMemo(
    () => create(value, { errorCorrectionLevel: "M" }),
    [value],
  );
  const path: string[] = [];
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (modules.get(x, y)) path.push(`M${x} ${y}h1v1h-1z`);
    }
  }
  const outer = modules.size + 8;
  return (
    <svg
      className={className}
      viewBox={`-4 -4 ${outer} ${outer}`}
      role="img"
      aria-label="WalletConnect pairing code"
      shapeRendering="crispEdges"
    >
      <title>WalletConnect pairing code</title>
      <path fill="#fff" d={`M-4 -4h${outer}v${outer}h-${outer}z`} />
      <path fill="#000" d={path.join("")} />
    </svg>
  );
}
