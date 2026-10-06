/**
 * The pegboard — "trail to the buck pole" (REQUIREMENTS §5.2). A wood-plank
 * board, 4 rows of 30 holes (1-30, 31-60, 61-90, 91-120) in groups of 5, one
 * lane per player/team per row, the 121 "Buck pole" hole, and the skunk line at
 * 91. Two pegs per side, leapfrog style (back peg dimmer). Fits a 390px phone.
 */

export interface PegLane {
  label: string;
  color: string; // a --peg-* value
  front: number; // current score (0..121)
  back: number; // the trailing peg
}

export interface PegboardProps {
  lanes: PegLane[];
  width?: number;
}

const HOLES_PER_ROW = 30;
const ROWS = 4;
const L = 30; // left margin (labels)
const R = 30; // right margin (buck pole)
const S = 9; // hole spacing
const GROUP_GAP = 6; // extra gap every 5 holes
const LANE_GAP = 11;
const TOP = 12;
const ROW_PAD = 14;

function colX(col: number): number {
  return L + col * S + Math.floor(col / 5) * GROUP_GAP;
}

export function Pegboard({ lanes, width = 360 }: PegboardProps) {
  const rowBlockH = lanes.length * LANE_GAP + ROW_PAD;
  const height = TOP + ROWS * rowBlockH + 18;
  const rowY = (row: number) => TOP + row * rowBlockH + 6;
  const laneY = (row: number, li: number) => rowY(row) + li * LANE_GAP;
  const buckX = colX(29) + 22;

  // score 1..120 -> {row,col}; drawn relative to the lane line.
  const pos = (score: number, li: number): { x: number; y: number } | null => {
    if (score <= 0) return { x: L - 12, y: laneY(0, li) };
    if (score >= 121) return { x: buckX, y: laneY(3, li) };
    const row = Math.floor((score - 1) / 30);
    const col = (score - 1) % 30;
    return { x: colX(col), y: laneY(row, li) };
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="pegboard">
      {/* planks */}
      {Array.from({ length: ROWS }, (_, row) => (
        <rect
          key={row}
          x={L - 16}
          y={rowY(row) - 8}
          width={width - (L - 16) - 6}
          height={rowBlockH - 2}
          rx={5}
          fill="var(--board-wood)"
          opacity={0.55}
        />
      ))}

      {/* holes + row range labels */}
      {Array.from({ length: ROWS }, (_, row) => (
        <g key={`r${row}`}>
          <text x={6} y={rowY(row) + (lanes.length * LANE_GAP) / 2} fontSize={7} fill="var(--text-secondary)" fontFamily='"Barlow Condensed", sans-serif'>
            {row * 30 + 1}
          </text>
          {lanes.map((_, li) =>
            Array.from({ length: HOLES_PER_ROW }, (_, col) => (
              <circle key={`${row}-${li}-${col}`} cx={colX(col)} cy={laneY(row, li)} r={1.8} fill="#0f120d" />
            )),
          )}
        </g>
      ))}

      {/* skunk line at 91 (start of row 3) */}
      <line x1={colX(0) - 4} y1={rowY(3) - 8} x2={colX(0) - 4} y2={rowY(3) + lanes.length * LANE_GAP} stroke="var(--accent)" strokeWidth={1.5} opacity={0.8} />
      <text x={colX(0) - 2} y={rowY(3) - 10} fontSize={6} fill="var(--accent-ink)" fontFamily='"Barlow Condensed", sans-serif'>skunk</text>

      {/* buck pole (121) */}
      <circle cx={buckX} cy={laneY(0, 0) - 2} r={4} fill="none" stroke="var(--bone)" strokeWidth={1.2} />
      <path d={`M${buckX - 4} ${laneY(0, 0) - 10} q4 -6 8 0 M${buckX - 4} ${laneY(0, 0) - 10} q-2 -4 -5 -4 M${buckX + 4} ${laneY(0, 0) - 10} q2 -4 5 -4`} stroke="var(--bone)" strokeWidth={1} fill="none" />
      <text x={buckX} y={height - 6} fontSize={6.5} fill="var(--bone)" textAnchor="middle" fontFamily='"Barlow Condensed", sans-serif'>Buck pole</text>

      {/* pegs: back (dim) then front (solid) per lane */}
      {lanes.map((lane, li) => {
        const back = pos(lane.back, li);
        const front = pos(lane.front, li);
        return (
          <g key={`peg${li}`}>
            {back && <circle cx={back.x} cy={back.y} r={3} fill={lane.color} opacity={0.4} />}
            {front && <circle cx={front.x} cy={front.y} r={3.4} fill={lane.color} stroke="#0f120d" strokeWidth={0.5} />}
          </g>
        );
      })}
    </svg>
  );
}
