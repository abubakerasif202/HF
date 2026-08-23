"use client";

import dynamic from "next/dynamic";

export const ThreeTruckViewerClient = dynamic(
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
