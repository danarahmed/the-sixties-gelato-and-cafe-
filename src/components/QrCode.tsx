"use client";

import { useMemo } from "react";
import qrcode from "qrcode-generator";

/**
 * A square to scan with a phone's camera, drawn as one path: crisp at any
 * size, dark on white with its quiet margin in light and dark alike, as
 * cameras read it.
 */
export function QrCode({
  text,
  size,
  label,
  testId,
}: {
  text: string;
  size: number;
  /** What the square opens, for a screen reader. */
  label: string;
  testId?: string;
}) {
  const { path, n } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    }
    return { path: d, n: count };
  }, [text]);
  const quiet = 4;
  const box = n + quiet * 2;
  return (
    <svg
      className="qr"
      role="img"
      aria-label={label}
      viewBox={`${-quiet} ${-quiet} ${box} ${box}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      data-testid={testId}
      data-text={text}
    >
      <rect x={-quiet} y={-quiet} width={box} height={box} fill="#ffffff" />
      <path d={path} fill="#1d1410" />
    </svg>
  );
}
