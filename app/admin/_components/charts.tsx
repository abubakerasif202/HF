import type { CSSProperties } from "react";

/**
 * Dependency-free SVG/CSS data visualisation for the admin. Everything is
 * deterministic server markup (no client JS, no hydration risk) and takes
 * REAL numbers only — callers decide what to show when there is no data.
 * Colours come from the --a-viz-* tokens so charts follow the theme.
 */

export interface BarDatum {
  label: string;
  value: number;
  accent?: boolean;
  muted?: boolean;
}

/** Vertical bars with grid, per-bar tooltips and a text summary for assistive tech. */
export function BarChart({ data, title, unit = "" }: { data: BarDatum[]; title: string; unit?: string }) {
  const width = 480;
  const plotHeight = 132;
  const labelHeight = 26;
  const max = Math.max(1, ...data.map((d) => d.value));
  const gap = data.length > 12 ? 5 : 9;
  const barWidth = (width - gap * (data.length - 1)) / Math.max(1, data.length);
  const labelEvery = data.length > 10 ? 2 : 1;
  const summary = data.map((d) => `${d.label}: ${d.value}${unit}`).join(", ");

  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${width} ${plotHeight + labelHeight}`} role="img" aria-label={`${title}. ${summary}`}>
        {[0, 0.5, 1].map((fraction) => (
          <line key={fraction} className="grid" x1="0" x2={width} y1={plotHeight - plotHeight * fraction} y2={plotHeight - plotHeight * fraction} />
        ))}
        {data.map((d, index) => {
          const height = Math.max(d.value === 0 ? 0 : 3, (d.value / max) * (plotHeight - 4));
          const x = index * (barWidth + gap);
          return (
            <g key={`${d.label}-${index}`}>
              <rect
                className="bar"
                x={x}
                y={plotHeight - height}
                width={barWidth}
                height={height}
                rx={Math.min(6, barWidth / 2)}
                data-accent={d.accent || undefined}
                data-muted={d.muted || undefined}
                style={{ "--i": index } as CSSProperties}
              >
                <title>{`${d.label}: ${d.value}${unit}`}</title>
              </rect>
              {index % labelEvery === 0 && (
                <text className="axis-label" x={x + barWidth / 2} y={plotHeight + 17} textAnchor="middle">{d.label}</text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Smooth area sparkline for metric-card artwork. Decorative (aria-hidden by the caller). */
export function Sparkline({ values, tone = "gold" }: { values: number[]; tone?: "gold" | "emerald" }) {
  const w = 200;
  const h = 84;
  const pad = 6;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const points = values.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)] as const);
  const line = points.map(([x, y], i) => {
    if (i === 0) return `M${x.toFixed(1)} ${y.toFixed(1)}`;
    const [px, py] = points[i - 1];
    const cx = (px + x) / 2;
    return `C${cx.toFixed(1)} ${py.toFixed(1)} ${cx.toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  const last = points[points.length - 1];
  const first = points[0];
  const area = last && first ? `${line} L${last[0].toFixed(1)} ${h} L${first[0].toFixed(1)} ${h} Z` : "";
  const stroke = tone === "gold" ? "#e1c895" : "#7fc3a8";
  let length = 0;
  for (let i = 1; i < points.length; i += 1) length += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  const gradientId = `spark-${tone}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="none" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={area} fill={`url(#${gradientId})`} />}
      {line && <path d={line} fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ ["--len" as string]: Math.ceil(length) + 20, strokeDasharray: Math.ceil(length) + 20, animation: "a-draw 1200ms var(--a-ease) both" }} />}
      {last && <circle cx={last[0]} cy={last[1]} r="3.5" fill={stroke} />}
    </svg>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

/** Ring chart with a legend. The legend carries the exact numbers, so colour is never the only signal. */
export function DonutChart({ segments, centerValue, centerLabel, title }: { segments: DonutSegment[]; centerValue: string | number; centerLabel: string; title: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div>
      <div className="a-donut" role="img" aria-label={`${title}. ${segments.map((s) => `${s.label}: ${s.value}`).join(", ")}`}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="track" cx="50" cy="50" r={radius} />
          {total > 0 && segments.filter((s) => s.value > 0).map((segment, index) => {
            const length = (segment.value / total) * circumference;
            const dash = `${Math.max(0, length - 1.6)} ${circumference - Math.max(0, length - 1.6)}`;
            const element = (
              <circle
                key={segment.label}
                className="seg"
                cx="50"
                cy="50"
                r={radius}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                style={{ "--c": segment.color, "--i": index } as CSSProperties}
              />
            );
            offset += length;
            return element;
          })}
        </svg>
        <div className="a-donut-center">
          <div className="a-donut-value">{centerValue}</div>
          <div className="a-donut-label">{centerLabel}</div>
        </div>
      </div>
      <ul className="a-legend">
        {segments.map((segment) => (
          <li key={segment.label}>
            <i style={{ "--c": segment.color } as CSSProperties} />
            {segment.label} <b>{segment.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface PipelineStage {
  label: string;
  count: number;
  color: string;
}

/** Horizontal enquiry pipeline: bar length is relative to the busiest stage. */
export function PipelineBars({ stages }: { stages: PipelineStage[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <ol className="a-pipeline">
      {stages.map((stage, index) => (
        <li className="a-pipeline-row" key={stage.label}>
          <span className="a-pipeline-name">{stage.label}</span>
          <span className="a-pipeline-track" aria-hidden="true">
            <span className="a-pipeline-fill" style={{ width: `${stage.count === 0 ? 0 : Math.max(4, (stage.count / max) * 100)}%`, "--c": stage.color, "--i": index } as CSSProperties} />
          </span>
          <span className="a-pipeline-count">{stage.count}</span>
        </li>
      ))}
    </ol>
  );
}
