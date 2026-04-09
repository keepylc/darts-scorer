import { useCallback, useRef } from "react";
import type { DartThrow } from "@/lib/types";
import { SECTORS } from "@/lib/dartUtils";

interface DartboardProps {
  onThrow: (sector: number, multiplier: number) => void;
  disabled: boolean;
  lastThrow?: DartThrow;
}

const CX = 200;
const CY = 200;
const DEG_PER_SECTOR = 18;
const OFFSET_DEG = -9; // sector 20 centered at top

// Radii
const R_DOUBLE_BULL = 12.7;
const R_BULL = 31.8;
const R_INNER_SINGLE = 99;
const R_TRIPLE_OUTER = 107;
const R_OUTER_SINGLE = 162;
const R_DOUBLE_OUTER = 170;
const R_BOARD = 195;
const R_LABELS = 183;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function polarToXY(cx: number, cy: number, r: number, angleDeg: number): [number, number] {
  const rad = toRad(angleDeg - 90); // SVG: 0° = right, we want 0° = top
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number
): string {
  const [ox1, oy1] = polarToXY(cx, cy, outerR, startDeg);
  const [ox2, oy2] = polarToXY(cx, cy, outerR, endDeg);
  const [ix2, iy2] = polarToXY(cx, cy, innerR, endDeg);
  const [ix1, iy1] = polarToXY(cx, cy, innerR, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;

  return [
    `M ${ox1} ${oy1}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${ox2} ${oy2}`,
    `L ${ix2} ${iy2}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1}`,
    `Z`,
  ].join(" ");
}

// Color scheme
function getSingleColor(index: number): string {
  return index % 2 === 0 ? "#f5f0e8" : "#2d2d2d";
}
function getRingColor(index: number): string {
  return index % 2 === 0 ? "#1db954" : "#e63946";
}

function getHighlightPath(sector: number, multiplier: number): { innerR: number; outerR: number } | null {
  if (sector === 25 && multiplier === 2) return null; // circle
  if (sector === 25 && multiplier === 1) return null; // circle
  if (sector === 0) return null;

  if (multiplier === 1) {
    // Could be inner or outer single — highlight both
    return { innerR: R_BULL, outerR: R_INNER_SINGLE };
  }
  if (multiplier === 3) return { innerR: R_INNER_SINGLE, outerR: R_TRIPLE_OUTER };
  if (multiplier === 2) return { innerR: R_OUTER_SINGLE, outerR: R_DOUBLE_OUTER };
  return null;
}

export default function DartboardSVG({ onThrow, disabled, lastThrow }: DartboardProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (disabled) return;
      const svg = svgRef.current;
      if (!svg) return;

      const rect = svg.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (400 / rect.width) - CX;
      const y = (e.clientY - rect.top) * (400 / rect.height) - CY;
      const r = Math.sqrt(x * x + y * y);
      const angleDeg = (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360;

      if (r <= R_DOUBLE_BULL) {
        onThrow(25, 2);
        return;
      }
      if (r <= R_BULL) {
        onThrow(25, 1);
        return;
      }
      if (r > R_DOUBLE_OUTER) {
        onThrow(0, 0); // miss
        return;
      }

      const sectorIndex = Math.floor(((angleDeg + 9) % 360) / DEG_PER_SECTOR);
      const sector = SECTORS[sectorIndex % 20];

      let multiplier: number;
      if (r <= R_INNER_SINGLE) multiplier = 1;
      else if (r <= R_TRIPLE_OUTER) multiplier = 3;
      else if (r <= R_OUTER_SINGLE) multiplier = 1;
      else multiplier = 2;

      onThrow(sector, multiplier);
    },
    [onThrow, disabled]
  );

  // Render sector paths
  const sectorElements = SECTORS.map((sector, index) => {
    const startAngle = OFFSET_DEG + index * DEG_PER_SECTOR;
    const endAngle = startAngle + DEG_PER_SECTOR;

    return (
      <g key={sector} className={disabled ? "" : "cursor-pointer"}>
        {/* Outer single */}
        <path
          d={arcPath(CX, CY, R_TRIPLE_OUTER, R_OUTER_SINGLE, startAngle, endAngle)}
          fill={getSingleColor(index)}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth="0.5"
          className={disabled ? "" : "hover:opacity-80 transition-opacity"}
        />
        {/* Double ring */}
        <path
          d={arcPath(CX, CY, R_OUTER_SINGLE, R_DOUBLE_OUTER, startAngle, endAngle)}
          fill={getRingColor(index)}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth="0.5"
          className={disabled ? "" : "hover:opacity-80 transition-opacity"}
        />
        {/* Inner single */}
        <path
          d={arcPath(CX, CY, R_BULL, R_INNER_SINGLE, startAngle, endAngle)}
          fill={getSingleColor(index)}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth="0.5"
          className={disabled ? "" : "hover:opacity-80 transition-opacity"}
        />
        {/* Triple ring */}
        <path
          d={arcPath(CX, CY, R_INNER_SINGLE, R_TRIPLE_OUTER, startAngle, endAngle)}
          fill={getRingColor(index)}
          stroke="rgba(0,0,0,0.3)"
          strokeWidth="0.5"
          className={disabled ? "" : "hover:opacity-80 transition-opacity"}
        />
      </g>
    );
  });

  // Sector labels
  const labelElements = SECTORS.map((sector, index) => {
    const angle = OFFSET_DEG + index * DEG_PER_SECTOR + DEG_PER_SECTOR / 2;
    const [lx, ly] = polarToXY(CX, CY, R_LABELS, angle);
    return (
      <text
        key={`label-${sector}`}
        x={lx}
        y={ly}
        fill="white"
        fontSize="14"
        fontWeight="bold"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {sector}
      </text>
    );
  });

  // Last throw highlight
  let highlightElement = null;
  if (lastThrow && !(lastThrow.sector === 0 && lastThrow.multiplier === 0)) {
    if (lastThrow.sector === 25) {
      const hr = lastThrow.multiplier === 2 ? R_DOUBLE_BULL : R_BULL;
      highlightElement = (
        <circle
          cx={CX}
          cy={CY}
          r={hr}
          fill="none"
          stroke="#FFD700"
          strokeWidth="2"
          className="animate-dart-pulse"
          style={{ pointerEvents: "none" }}
        />
      );
    } else {
      const sectorIndex = SECTORS.indexOf(lastThrow.sector);
      if (sectorIndex >= 0) {
        const startAngle = OFFSET_DEG + sectorIndex * DEG_PER_SECTOR;
        const endAngle = startAngle + DEG_PER_SECTOR;
        const hl = getHighlightPath(lastThrow.sector, lastThrow.multiplier);
        if (hl) {
          highlightElement = (
            <path
              d={arcPath(CX, CY, hl.innerR, hl.outerR, startAngle, endAngle)}
              fill="none"
              stroke="#FFD700"
              strokeWidth="2"
              className="animate-dart-pulse"
              style={{ pointerEvents: "none" }}
            />
          );
        }
      }
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        ref={svgRef}
        viewBox="0 0 400 400"
        className="w-full max-w-[360px] aspect-square"
        onClick={handleClick}
        style={{ touchAction: "manipulation" }}
      >
        {/* Board background */}
        <circle cx={CX} cy={CY} r={R_BOARD} fill="#1a1a1a" />

        {/* Miss ring (click area beyond double) */}
        <circle
          cx={CX}
          cy={CY}
          r={R_BOARD}
          fill="transparent"
          stroke="none"
        />

        {sectorElements}

        {/* Bull */}
        <circle
          cx={CX}
          cy={CY}
          r={R_BULL}
          fill="#1db954"
          stroke="rgba(0,0,0,0.3)"
          strokeWidth="0.5"
          className={disabled ? "" : "cursor-pointer hover:opacity-80 transition-opacity"}
        />

        {/* Double Bull */}
        <circle
          cx={CX}
          cy={CY}
          r={R_DOUBLE_BULL}
          fill="#e63946"
          stroke="rgba(0,0,0,0.3)"
          strokeWidth="0.5"
          className={disabled ? "" : "cursor-pointer hover:opacity-80 transition-opacity"}
        />

        {labelElements}

        {highlightElement}
      </svg>

      <button
        type="button"
        onClick={() => !disabled && onThrow(0, 0)}
        disabled={disabled}
        className="px-6 py-2.5 rounded-lg bg-muted text-muted-foreground font-medium text-sm
                   hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors min-h-[44px]"
      >
        Мимо (0 очков)
      </button>
    </div>
  );
}
