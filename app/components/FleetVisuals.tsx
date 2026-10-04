import { useId } from "react";
import type { TruckClass } from "../../lib/site-data";

/**
 * Illustrated side-on box trucks, drawn to scale against each other (the viewBox
 * width of each truck is its real proportion of the largest one). These are
 * illustrations of the three truck SIZES — not photographs of the HF fleet.
 * To use real fleet photos later, swap the <TruckIllustration> inside
 * TruckCard / HeroFleet for an <img> and keep the same width ratios.
 */
const BODY: Record<TruckClass, { box: number; height: number; label: string; axles: number }> = {
  Small: { box: 150, height: 68, label: "8T", axles: 1 },
  MR: { box: 195, height: 80, label: "12T", axles: 1 },
  HR: { box: 245, height: 92, label: "16T", axles: 2 },
};

const GROUND = 112;
const CHASSIS = 100;
const CAB_WIDTH = 58;
const START = 10;
const VIEW_HEIGHT = 128;

/** Width of each truck as a fraction of the HR truck, so layouts can show true relative size. */
export function truckWidthRatio(truckClass: TruckClass): number {
  return (START + BODY[truckClass].box + 4 + CAB_WIDTH + 6) / (START + BODY.HR.box + 4 + CAB_WIDTH + 6);
}

export function TruckIllustration({ truckClass, label, className = "" }: { truckClass: TruckClass; label: string; className?: string }) {
  const { box, height, label: tonLabel, axles } = BODY[truckClass];
  const width = START + box + 4 + CAB_WIDTH + 6;
  const boxTop = CHASSIS - height;
  const cabX = START + box + 4;
  const cabTop = CHASSIS - 56;
  const wheelY = GROUND - 4;
  const rearWheels = axles === 2 ? [START + box * 0.16, START + box * 0.3] : [START + box * 0.2];
  const frontWheel = cabX + 34;
  const titleId = useId();

  return (
    <svg className={`truck-art ${className}`.trim()} viewBox={`0 0 ${width} ${VIEW_HEIGHT}`} role="img" aria-labelledby={titleId} focusable="false">
      <title id={titleId}>{label}</title>
      <ellipse cx={width / 2} cy={GROUND + 6} rx={width / 2 - 8} ry="5" fill="rgba(0,0,0,0.28)" />
      {/* cargo box */}
      <rect x={START} y={boxTop} width={box} height={height} rx="6" fill="#faf8f2" stroke="#bf8d26" strokeWidth="2" />
      <rect x={START} y={CHASSIS - 12} width={box} height="12" fill="#0f4e34" />
      <rect x={START} y={CHASSIS - 14} width={box} height="2.5" fill="#ffd700" />
      <text x={START + box / 2} y={boxTop + height * 0.46} textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700" fontSize={height * 0.34} fill="#0f4e34">
        HF
      </text>
      <text x={START + box / 2} y={boxTop + height * 0.7} textAnchor="middle" fontFamily="Inter, Arial, sans-serif" fontWeight="800" fontSize="11" letterSpacing="2" fill="#a6152c">
        {tonLabel}
      </text>
      {/* cab */}
      <path d={`M${cabX} ${CHASSIS} V${cabTop} H${cabX + 34} L${cabX + CAB_WIDTH} ${cabTop + 24} V${CHASSIS} Z`} fill="#f6f4ee" stroke="#9aa8a1" strokeWidth="2" strokeLinejoin="round" />
      <path d={`M${cabX + 8} ${cabTop + 8} H${cabX + 31} L${cabX + 47} ${cabTop + 24} H${cabX + 8} Z`} fill="#cfe5da" opacity="0.92" />
      <rect x={cabX} y={CHASSIS - 12} width={CAB_WIDTH} height="12" fill="#0f4e34" />
      <rect x={cabX + CAB_WIDTH - 6} y={CHASSIS - 14} width="6" height="5" rx="2" fill="#ffd700" />
      {/* chassis + wheels */}
      <rect x={START} y={CHASSIS} width={box + 4 + CAB_WIDTH} height="4" fill="#041f14" />
      {[...rearWheels, frontWheel].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy={wheelY} r="13" fill="#0b1210" />
          <circle cx={cx} cy={wheelY} r="6" fill="#9aa8a1" />
          <circle cx={cx} cy={wheelY} r="2.2" fill="#0b1210" />
        </g>
      ))}
    </svg>
  );
}
