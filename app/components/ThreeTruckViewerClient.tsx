"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

const ThreeTruckViewer = dynamic(
  () => import("./ThreeTruckViewer").then((mod) => mod.ThreeTruckViewer),
  {
    ssr: false,
    loading: () => (
      <div className="section three-section three-loader-shell">
        <div className="three-loader">
          <div className="three-spinner" />
          <span>Loading 3D fleet visualizer…</span>
        </div>
      </div>
    ),
  },
);

/**
 * The viewer is client-only, so the server sends a short placeholder and this section
 * grows by roughly 1.5k pixels once Three.js mounts. A browser landing on a deep link
 * such as /#reviews performs its hash jump against the pre-mount layout, leaving every
 * anchor below this section hundreds of pixels short of its target. Re-applying the
 * hash once the viewer has mounted corrects the position without reserving a large
 * empty box or changing anything visually.
 */
const SETTLE_MS = 1500;

export function ThreeTruckViewerClient() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;

    // The section keeps growing for a few frames after mount, and more slowly on
    // narrow viewports, so correct the position until the document stops resizing
    // rather than guessing a single frame.
    const realign = () => target.scrollIntoView();
    realign();

    const observer = new ResizeObserver(realign);
    observer.observe(document.documentElement);
    const stop = window.setTimeout(() => observer.disconnect(), SETTLE_MS);

    return () => {
      observer.disconnect();
      window.clearTimeout(stop);
    };
  }, []);

  return <ThreeTruckViewer />;
}
