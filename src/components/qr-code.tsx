"use client";

import { useMemo } from "react";
import { encode } from "uqr";

/** A QR code drawn as one SVG path, black on white for reliable scanning. */
export function QrCode({ value, size = 160, label }: { value: string; size?: number; label: string }) {
  const { d, n } = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 2 });
    let path = "";
    qr.data.forEach((row, y) =>
      row.forEach((on, x) => {
        if (on) path += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return { d: path, n: qr.size };
  }, [value]);
  return (
    <svg
      viewBox={`0 0 ${n} ${n}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className="rounded-lg bg-white"
    >
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#111827" />
    </svg>
  );
}
