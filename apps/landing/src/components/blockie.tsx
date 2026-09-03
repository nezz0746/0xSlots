"use client";

import blockies from "blockies-ts";
import { useMemo } from "react";

interface BlockieProps {
  address: string;
  /**
   * The identicon GRID, in blocks — not the rendered pixel size. Callers size
   * the element with `className` (`size-5`) or `style`; changing this changes
   * how coarse the pattern is, which is rarely what a caller wants.
   */
  size?: number;
  className?: string;
  /** For callers whose dimensions are a number rather than a utility class. */
  style?: React.CSSProperties;
}

export function Blockie({ address, size = 8, className, style }: BlockieProps) {
  const dataUrl = useMemo(
    () =>
      blockies
        .create({ seed: address.toLowerCase(), size, scale: 4 })
        .toDataURL(),
    [address, size],
  );

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={dataUrl} alt="" className={className} style={style} />
  );
}
