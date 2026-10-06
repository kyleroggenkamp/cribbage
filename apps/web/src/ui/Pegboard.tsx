/**
 * The pegboard — "trail to the buck pole" (REQUIREMENTS §5.2), drawn as a
 * classic serpentine 3-street board: Start at the bottom-left, up the left
 * street, around the top, down the right street, around the bottom, then up the
 * center street to the finish (121). Each rank has one hole per lane
 * (player/team); two pegs per lane, leapfrog style (back peg dimmer). The small
 * grid underneath is the games-won counter.
 *
 * Geometry is generated along a centerline and resampled to 122 evenly-spaced
 * positions (0 = Start … 121 = finish), so layout tweaks are just the constants
 * below.
 */

export interface PegLane {
  label: string;
  color: string; // a --peg-* value
  front: number; // current score (0..121)
  back: number; // the trailing peg
}

export interface PegboardProps {
  lanes: PegLane[];
  skunkLine?: number; // default 91
}

// ---- layout knobs ----------------------------------------------------------
const VB_W = 200;
const VB_H = 400;
const xL = 48;
const xC = 100;
const xR = 152;
const yTop = 64; // top of the straight streets
const yBot = 320; // bottom of the straight streets
const yCenterTop = 54; // where the center street ends (just inside the top loop)
const rTop = (xR - xL) / 2;
const rBot = (xR - xC) / 2;
const LANE_GAP = 7.5;
const HOLE_R = 2.6;

interface P { x: number; y: number }

function straight(x: number, y0: number, y1: number, n: number): P[] {
  return Array.from({ length: n }, (_, i) => ({ x, y: y0 + ((y1 - y0) * i) / (n - 1) }));
}
function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number, sign: number): P[] {
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / (n - 1);
    return { x: cx + r * Math.cos(a), y: cy + sign * r * Math.sin(a) };
  });
}

/** Resample a dense polyline to exactly `count` evenly-spaced points. */
function resample(pts: P[], count: number): P[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i]!.x - pts[i - 1]!.x;
    const dy = pts[i]!.y - pts[i - 1]!.y;
    cum.push(cum[i - 1]! + Math.hypot(dx, dy));
  }
  const total = cum[cum.length - 1]!;
  const out: P[] = [];
  let seg = 1;
  for (let k = 0; k < count; k++) {
    const target = (k / (count - 1)) * total;
    while (seg < pts.length - 1 && cum[seg]! < target) seg++;
    const t = (target - cum[seg - 1]!) / Math.max(1e-6, cum[seg]! - cum[seg - 1]!);
    out.push({
      x: pts[seg - 1]!.x + (pts[seg]!.x - pts[seg - 1]!.x) * t,
      y: pts[seg - 1]!.y + (pts[seg]!.y - pts[seg - 1]!.y) * t,
    });
  }
  return out;
}

// Build the centerline once (module scope — it never changes).
const CENTERS: P[] = (() => {
  const dense: P[] = [
    ...straight(xL, yBot, yTop, 90), // up the left street
    ...arc(xC, yTop, rTop, Math.PI, 0, 60, -1).slice(1), // over the top (left->right)
    ...straight(xR, yTop, yBot, 90).slice(1), // down the right street
    ...arc((xR + xC) / 2, yBot, rBot, 0, Math.PI, 40, 1).slice(1), // around the bottom (right->center)
    ...straight(xC, yBot, yCenterTop, 80).slice(1), // up the center street to the finish
  ];
  return resample(dense, 122); // indices 0..121
})();

function perp(i: number): P {
  const a = CENTERS[Math.max(0, i - 1)]!;
  const b = CENTERS[Math.min(121, i + 1)]!;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

function laneOffset(laneIndex: number, lanes: number): number {
  return (laneIndex - (lanes - 1) / 2) * LANE_GAP;
}

export function Pegboard({ lanes, skunkLine = 91 }: PegboardProps) {
  const n = lanes.length;
  const holeAt = (pos: number, li: number): P => {
    const c = CENTERS[Math.max(0, Math.min(121, pos))]!;
    const pp = perp(pos);
    const off = laneOffset(li, n);
    return { x: c.x + pp.x * off, y: c.y + pp.y * off };
  };

  const labels = [0, 15, 30, 45, 60, 75, 90, 105, 120];

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" role="img" aria-label="cribbage pegboard">
      {/* board body: trace the centerline as a thick wood stroke */}
      <polyline
        points={CENTERS.map((c) => `${c.x},${c.y}`).join(' ')}
        fill="none"
        stroke="var(--board-wood)"
        strokeWidth={n * LANE_GAP + 10}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.55}
      />

      {/* holes */}
      {CENTERS.map((_, pos) =>
        Array.from({ length: n }, (_, li) => {
          const h = holeAt(pos, li);
          return <circle key={`${pos}-${li}`} cx={h.x} cy={h.y} r={HOLE_R} fill="#0f120d" />;
        }),
      )}

      {/* milestone numbers */}
      {labels.map((pos) => {
        const c = CENTERS[pos]!;
        const pp = perp(pos);
        const d = (n * LANE_GAP) / 2 + 7;
        return (
          <text
            key={`lbl${pos}`}
            x={c.x + pp.x * d}
            y={c.y + pp.y * d + 2}
            fontSize={7}
            fill="var(--text-secondary)"
            textAnchor="middle"
            fontFamily='"Barlow Condensed", sans-serif'
          >
            {pos === 0 ? 'S' : pos}
          </text>
        );
      })}

      {/* skunk line tick */}
      {(() => {
        const c = CENTERS[skunkLine]!;
        const pp = perp(skunkLine);
        const d = (n * LANE_GAP) / 2 + 2;
        return (
          <line
            x1={c.x - pp.x * d}
            y1={c.y - pp.y * d}
            x2={c.x + pp.x * d}
            y2={c.y + pp.y * d}
            stroke="var(--accent)"
            strokeWidth={1.5}
          />
        );
      })()}

      {/* finish (121) ring + antler + label */}
      {(() => {
        const c = CENTERS[121]!;
        return (
          <g>
            <circle cx={c.x} cy={c.y} r={5} fill="none" stroke="var(--bone)" strokeWidth={1.3} />
            <path
              d={`M${c.x - 5} ${c.y - 8} q5 -7 10 0 M${c.x - 5} ${c.y - 8} q-3 -5 -6 -5 M${c.x + 5} ${c.y - 8} q3 -5 6 -5`}
              stroke="var(--bone)"
              strokeWidth={1}
              fill="none"
            />
          </g>
        );
      })()}

      {/* pegs: back (dim) then front (solid) per lane */}
      {lanes.map((lane, li) => {
        const back = holeAt(lane.back, li);
        const front = holeAt(lane.front, li);
        return (
          <g key={`peg${li}`}>
            <circle cx={back.x} cy={back.y} r={3} fill={lane.color} opacity={0.4} />
            <circle cx={front.x} cy={front.y} r={3.4} fill={lane.color} stroke="#0f120d" strokeWidth={0.4} />
          </g>
        );
      })}

      {/* games-won counter box (decorative): two rows of 7 */}
      {(() => {
        const bx = xC - 35;
        const by = VB_H - 34;
        return (
          <g>
            <rect x={bx - 6} y={by - 8} width={82} height={26} rx={3} fill="none" stroke="var(--board-wood)" />
            {[0, 1].map((row) =>
              Array.from({ length: 7 }, (_, i) => (
                <circle key={`c${row}-${i}`} cx={bx + i * 10} cy={by + row * 10} r={2} fill="#0f120d" />
              )),
            )}
          </g>
        );
      })()}
    </svg>
  );
}
