"use client";

import type { CSSProperties, PointerEvent, ReactNode } from "react";

type TiltStyle = CSSProperties & { "--tilt-x"?: string; "--tilt-y"?: string };

export default function TelemetryCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || window.innerWidth < 768) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    event.currentTarget.style.setProperty("--tilt-x", `${-y * 3}deg`);
    event.currentTarget.style.setProperty("--tilt-y", `${x * 3}deg`);
  }

  function reset(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--tilt-x", "0deg");
    event.currentTarget.style.setProperty("--tilt-y", "0deg");
  }

  return <div className={`telemetry-card ${className}`} style={{ "--tilt-x": "0deg", "--tilt-y": "0deg" } as TiltStyle} onPointerMove={tilt} onPointerLeave={reset}>{children}</div>;
}
