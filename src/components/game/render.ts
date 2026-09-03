// ── Отрисовка на canvas: поле, блоки, бомбы с круговым фитилём, камни, частицы ─

import { BLOCK_COLORS, GRID_SIZE, isStone, stoneStage, type Grid, type Piece } from "./engine";

export const TRAY_SCALE = 0.55;

/** Фитиль тикает по времени: раз в столько секунд простоя.
 *  Это же — длительность одного круга анимации фитиля. */
export const IDLE_BOMB_TICK = 7;

/** Доля сгоревшего фитиля (0..1) — искра идёт по кругу за это время */
export function fuseFraction(g: GameState): number {
  return Math.max(0, Math.min(1, g.fuseAcc / IDLE_BOMB_TICK));
}

export interface LayoutMetrics {
  W: number;
  H: number;
  boardX: number;
  boardY: number;
  cell: number;
  trayY: number;
  trayH: number;
  dpr: number;
}

export function computeLayout(w: number, dpr: number): LayoutMetrics {
  const pad = 10;
  const cell = (w - pad * 2) / GRID_SIZE;
  const gap = 26;
  const trayH = Math.max(88, cell * 2.3);
  const board = cell * GRID_SIZE;
  return {
    W: w,
    H: Math.round(pad * 2 + board + gap + trayH + 10),
    boardX: pad,
    boardY: pad,
    cell,
    trayY: pad * 2 + board + gap,
    trayH,
    dpr,
  };
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface PopCell {
  r: number;
  c: number;
  t: number;
}

export interface DragState {
  slot: number;
  piece: Piece;
  x: number;
  y: number;
  lift: number;
  t: number;
  valid: boolean;
  row: number;
  col: number;
  wouldClear: { rows: number[]; cols: number[] } | null;
}

export interface ReturnAnim {
  slot: number;
  piece: Piece;
  x: number; // центр
  y: number;
  t: number;
}

export interface GameState {
  grid: Grid;
  pieces: (Piece | null)[];
  dead: boolean[];
  drag: DragState | null;
  anim: ReturnAnim | null;
  particles: Particle[];
  texts: FloatText[];
  pops: PopCell[];
  shake: number;
  time: number;
  streak: number;
  score: number;
  bestStart: number;
  lines: number;
  lives: number;
  defused: number;
  placements: number;
  /** ход, на котором появится следующая полевая бомба */
  nextBombAt: number;
  /** сколько секунд горит текущий круг фитиля — НЕ останавливается во время драга */
  fuseAcc: number;
  /** сколько блоков цвета цели убрано (для цели «собери») */
  collected: number;
  /** цвет цели «собери» — такие блоки подсвечены и выпадают чаще */
  goalColor: number | undefined;
  /** молоток взведён — следующий тап по блоку сносит его */
  armed: boolean;
  /** клетка под прицелом молотка */
  hammerTarget: { r: number; c: number } | null;
  overReason: "bombs" | "stall" | "moves" | null;
  over: boolean;
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Один «конфетный» блок с градиентом и блеском.
 *  highlight — пульсирующая белая рамка для блоков цвета цели «собери». */
export function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  colorIdx: number,
  alpha = 1,
  highlight = false,
): void {
  const col = BLOCK_COLORS[((colorIdx - 1) % BLOCK_COLORS.length + BLOCK_COLORS.length) % BLOCK_COLORS.length];
  const pad = s * 0.05;
  const r = s * 0.22;
  const w = s - pad * 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  const grad = ctx.createLinearGradient(0, y, 0, y + s);
  grad.addColorStop(0, col.top);
  grad.addColorStop(1, col.bottom);
  ctx.fillStyle = grad;
  roundRect(ctx, x + pad, y + pad, w, w, r);
  ctx.fill();
  // блик сверху
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  roundRect(ctx, x + pad + w * 0.1, y + pad + w * 0.09, w * 0.8, w * 0.3, r * 0.7);
  ctx.fill();
  // тёмная окантовка
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = Math.max(1, s * 0.035);
  roundRect(ctx, x + pad, y + pad, w, w, r);
  ctx.stroke();
  // рамка цвета цели
  if (highlight) {
    const wave = 0.55 + 0.45 * Math.sin(performance.now() / 300);
    ctx.strokeStyle = `rgba(255,255,255,${(alpha * (0.6 + 0.4 * wave)).toFixed(3)})`;
    ctx.lineWidth = Math.max(1.5, s * 0.07);
    roundRect(ctx, x + pad, y + pad, w, w, r);
    ctx.stroke();
  }
  ctx.restore();
}

/** Камень: стадия 0 — идеальный гладкий; стадия 1 — весь в трещинах (до разрушения) */
export function drawStone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  alpha = 1,
  stage = 0,
): void {
  const pad = s * 0.05;
  const r = s * 0.18;
  const inner = s - pad * 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  const grad = ctx.createLinearGradient(0, y, 0, y + s);
  if (stage >= 1) {
    // потемневший, «раскрошившийся» камень
    grad.addColorStop(0, "#787f8e");
    grad.addColorStop(0.5, "#565d68");
    grad.addColorStop(1, "#3a414c");
  } else {
    grad.addColorStop(0, "#8d93a3");
    grad.addColorStop(0.5, "#6b7280");
    grad.addColorStop(1, "#4b5563");
  }
  ctx.fillStyle = grad;
  roundRect(ctx, x + pad, y + pad, inner, inner, r);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = Math.max(1, s * 0.05);
  roundRect(ctx, x + pad, y + pad, inner, inner, r);
  ctx.stroke();
  // гладкий блик сверху (у целого — ярче)
  ctx.fillStyle = `rgba(255,255,255,${stage >= 1 ? 0.07 : 0.16})`;
  roundRect(ctx, x + pad + inner * 0.08, y + pad + inner * 0.07, inner * 0.84, inner * 0.24, r * 0.55);
  ctx.fill();

  if (stage >= 1) {
    // ── сеть трещин по всему камню ──
    ctx.strokeStyle = "rgba(10,9,14,0.8)";
    ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const cracks: [number, number][][] = [
      // сквозные трещины через весь камень
      [[0.16, 0.1], [0.38, 0.34], [0.3, 0.62], [0.52, 0.9]],
      [[0.86, 0.22], [0.62, 0.48], [0.78, 0.72]],
      [[0.1, 0.7], [0.34, 0.52], [0.28, 0.28]],
      [[0.7, 0.06], [0.58, 0.3], [0.74, 0.46]],
      [[0.3, 0.94], [0.46, 0.72], [0.66, 0.88]],
      [[0.06, 0.4], [0.26, 0.46], [0.2, 0.64]],
      // лучи от точки удара в центре
      [[0.52, 0.48], [0.44, 0.18]],
      [[0.52, 0.48], [0.66, 0.36]],
      [[0.52, 0.48], [0.4, 0.7]],
      [[0.52, 0.48], [0.7, 0.6]],
      [[0.52, 0.48], [0.6, 0.82]],
      [[0.52, 0.48], [0.34, 0.44]],
      // короткие ответвления
      [[0.38, 0.34], [0.52, 0.2]],
      [[0.62, 0.48], [0.56, 0.62]],
      [[0.34, 0.52], [0.48, 0.44]],
      [[0.46, 0.72], [0.34, 0.8]],
      [[0.58, 0.3], [0.66, 0.2]],
    ];
    ctx.beginPath();
    for (const line of cracks) {
      ctx.moveTo(x + line[0][0] * s, y + line[0][1] * s);
      for (let i = 1; i < line.length; i++) {
        ctx.lineTo(x + line[i][0] * s, y + line[i][1] * s);
      }
    }
    ctx.stroke();
    // тонкая паутинка вторичных трещин
    ctx.strokeStyle = "rgba(10,9,14,0.55)";
    ctx.lineWidth = Math.max(1, s * 0.032);
    const hair: [number, number][][] = [
      [[0.44, 0.18], [0.36, 0.1]],
      [[0.66, 0.36], [0.78, 0.34]],
      [[0.4, 0.7], [0.32, 0.62]],
      [[0.7, 0.6], [0.82, 0.54]],
      [[0.6, 0.82], [0.66, 0.9]],
      [[0.26, 0.46], [0.18, 0.4]],
      [[0.78, 0.72], [0.84, 0.8]],
    ];
    ctx.beginPath();
    for (const line of hair) {
      ctx.moveTo(x + line[0][0] * s, y + line[0][1] * s);
      ctx.lineTo(x + line[1][0] * s, y + line[1][1] * s);
    }
    ctx.stroke();
    // сколотые уголки
    ctx.fillStyle = "rgba(20,19,26,0.55)";
    const chip = (pts: [number, number][]): void => {
      ctx.beginPath();
      ctx.moveTo(x + pts[0][0] * s, y + pts[0][1] * s);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(x + pts[i][0] * s, y + pts[i][1] * s);
      ctx.closePath();
      ctx.fill();
    };
    chip([[pad, pad + 0.16 * s], [pad + 0.16 * s, pad], [pad + 0.3 * s, pad + 0.05 * s], [pad + 0.08 * s, pad + 0.26 * s]]);
    chip([
      [pad + inner - 0.02 * s, pad + inner - 0.16 * s],
      [pad + inner - 0.18 * s, pad + inner],
      [pad + inner - 0.34 * s, pad + inner - 0.04 * s],
    ]);
    chip([[pad + 0.06 * s, pad + inner - 0.02 * s], [pad + 0.2 * s, pad + inner - 0.06 * s], [pad + 0.1 * s, pad + inner - 0.2 * s]]);
    // крошки-точки
    ctx.fillStyle = "rgba(15,14,20,0.5)";
    for (const [dx, dy, dr] of [
      [0.24, 0.24, 0.025],
      [0.76, 0.3, 0.02],
      [0.64, 0.66, 0.025],
      [0.3, 0.8, 0.02],
      [0.5, 0.58, 0.018],
    ] as [number, number, number][]) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y + dy * s, dr * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Бомба: сфера с фитилём-искрой и цифрой.
 *  ring (0..1) — доля сгоревшего фитиля: искра идёт по кругу вокруг бомбы. */
export function drawBombBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  timer: number,
  time: number,
  alpha = 1,
  phase = 0,
  ring?: number,
): void {
  const urgent = timer <= 2;
  const pulse = urgent ? 1 + 0.09 * Math.sin(13 * time + phase) : 1 + 0.045 * Math.sin(4.5 * time + phase);
  ctx.save();
  ctx.globalAlpha = alpha;
  // подложка
  ctx.fillStyle = urgent ? "#241318" : "#181420";
  roundRect(ctx, x + s * 0.05, y + s * 0.05, s * 0.9, s * 0.9, s * 0.18);
  ctx.fill();
  // сфера бомбы
  const br = s * 0.34 * pulse;
  const cx = x + s / 2;
  const cy = y + s * 0.62;
  const grad = ctx.createRadialGradient(cx - br * 0.35, cy - br * 0.45, br * 0.1, cx, cy, br);
  grad.addColorStop(0, "#5a5266");
  grad.addColorStop(0.55, "#2c2436");
  grad.addColorStop(1, "#161122");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, br, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = urgent ? "rgba(255,90,60,0.95)" : "rgba(255,255,255,0.16)";
  ctx.lineWidth = Math.max(1.2, s * 0.04);
  ctx.stroke();
  // блик на сфере
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.ellipse(cx - br * 0.38, cy - br * 0.48, br * 0.32, br * 0.2, -0.6, 0, Math.PI * 2);
  ctx.fill();
  // тревожное кольцо-пульс
  if (urgent) {
    const a = 0.35 + 0.3 * Math.sin(13 * time + phase);
    ctx.strokeStyle = `rgba(255,60,40,${a.toFixed(3)})`;
    ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.beginPath();
    ctx.arc(cx, cy, br + s * 0.09, 0, Math.PI * 2);
    ctx.stroke();
  }
  // фитильный stub + изогнутый фитиль
  const stubW = s * 0.2;
  const stubH = s * 0.09;
  const stubX = cx - stubW / 2;
  const stubY = cy - br - stubH * 0.8;
  ctx.fillStyle = "#6b6478";
  roundRect(ctx, stubX, stubY, stubW, stubH, s * 0.03);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 1;
  roundRect(ctx, stubX, stubY, stubW, stubH, s * 0.03);
  ctx.stroke();
  const sparkX = cx + s * 0.2;
  const sparkY = y + s * 0.1;
  ctx.strokeStyle = "#d9c9a3";
  ctx.lineWidth = Math.max(1.5, s * 0.05);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, stubY);
  ctx.quadraticCurveTo(cx + s * 0.04, y + s * 0.12, sparkX, sparkY);
  ctx.stroke();
  // искра на конце фитиля
  const sparkR = s * (0.055 + 0.045 * Math.abs(Math.sin(time * (urgent ? 16 : 9) + phase)));
  const sparkGrad = ctx.createRadialGradient(sparkX, sparkY, 0, sparkX, sparkY, 2.2 * sparkR);
  sparkGrad.addColorStop(0, "#ffffff");
  sparkGrad.addColorStop(0.4, urgent ? "#ff8a4d" : "#ffd34d");
  sparkGrad.addColorStop(1, "rgba(255,120,40,0)");
  ctx.fillStyle = sparkGrad;
  ctx.beginPath();
  ctx.arc(sparkX, sparkY, 2.2 * sparkR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = urgent ? "#ffb14d" : "#fff3b0";
  ctx.beginPath();
  ctx.arc(sparkX, sparkY, sparkR * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // цифра таймера
  ctx.fillStyle = urgent ? "#ff6a4d" : "#f4f0ff";
  ctx.font = `900 ${Math.round(s * 0.4)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = Math.max(2, s * 0.07);
  ctx.strokeText(String(Math.max(0, timer)), cx, cy);
  ctx.fillText(String(Math.max(0, timer)), cx, cy);
  // круговой фитиль: искра едет по кольцу, дуга — сгоревшая часть
  if (ring !== undefined && ring > 0.001 && ring < 0.999) {
    const trackR = s * 0.42;
    const lw = Math.max(2, s * 0.07);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(cx, cy, trackR, 0, Math.PI * 2);
    ctx.stroke();
    const p = Math.max(0, Math.min(1, (ring - 0.4) / 0.6));
    const col = `rgba(255,${Math.round(194 - 117 * p)},${Math.round(61 + 16 * p)},0.95)`;
    ctx.strokeStyle = col;
    ctx.lineCap = "round";
    const a0 = -Math.PI / 2 - 2 * Math.PI * ring;
    ctx.beginPath();
    ctx.arc(cx, cy, trackR, a0, -Math.PI / 2, true);
    ctx.stroke();
    // бегающая искра на конце дуги
    const sx = cx + trackR * Math.cos(a0);
    const sy = cy + trackR * Math.sin(a0);
    const sp = s * 0.07 * (0.7 + 0.3 * Math.abs(Math.sin(11 * time + phase)));
    const g2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, 2.4 * sp);
    g2.addColorStop(0, "#ffffff");
    g2.addColorStop(0.35, p > 0.5 ? "#ff8a4d" : "#ffd34d");
    g2.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(sx, sy, 2.4 * sp, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff3b0";
    ctx.beginPath();
    ctx.arc(sx, sy, sp * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Фигура, центрированная в (cx, cy), клетка = cell * scale */
export function drawPieceAt(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  cx: number,
  cy: number,
  cell: number,
  scale: number,
  alpha = 1,
  time = 0,
  goalColor?: number,
  ring?: number,
): void {
  const w = piece.shape.w * cell * scale;
  const h = piece.shape.h * cell * scale;
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  piece.shape.cells.forEach(([dr, dc], i) => {
    const x = x0 + dc * cell * scale;
    const y = y0 + dr * cell * scale;
    if (piece.bomb === i && piece.bombTimer !== null) {
      drawBombBlock(ctx, x, y, cell * scale, piece.bombTimer, time, alpha, 1.3 * i, ring);
    } else {
      drawBlock(ctx, x, y, cell * scale, piece.color, alpha, goalColor === piece.color);
    }
  });
}

/** Поле с подложкой, пустыми клетками, бомбами и камнями */
export function drawBoard(ctx: CanvasRenderingContext2D, g: GameState, L: LayoutMetrics): void {
  const bs = L.cell * GRID_SIZE;
  ctx.save();
  roundRect(ctx, L.boardX - 6, L.boardY - 6, bs + 12, bs + 12, 18);
  ctx.fillStyle = "#191722";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.stroke();

  const popMap = new Map<number, number>();
  for (const p of g.pops) popMap.set(p.r * 100 + p.c, p.t);
  const ring = fuseFraction(g);

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const x = L.boardX + c * L.cell;
      const y = L.boardY + r * L.cell;
      const v = g.grid[r][c];
      if (v === 0) {
        ctx.fillStyle = "#12111a";
        roundRect(ctx, x + L.cell * 0.06, y + L.cell * 0.06, L.cell * 0.88, L.cell * 0.88, L.cell * 0.16);
        ctx.fill();
      } else {
        const t = popMap.get(r * 100 + c);
        let sc = 1;
        if (t !== undefined && t < 0.24) {
          sc = 1 + 0.22 * Math.sin((t / 0.24) * Math.PI);
        }
        const off = ((1 - sc) * L.cell) / 2;
        if (v < 0) {
          drawBombBlock(ctx, x + off, y + off, L.cell * sc, -v, g.time, 1, 0.9 * r + 1.7 * c, ring);
        } else if (isStone(v)) {
          drawStone(ctx, x + off, y + off, L.cell * sc, 1, stoneStage(v));
        } else {
          drawBlock(ctx, x + off, y + off, L.cell * sc, v, 1, g.goalColor === v);
        }
      }
    }
  }
  ctx.restore();
}

/** Подсветка линий, которые взорвутся при сбросе (предвкушение!) */
export function drawClearPreview(
  ctx: CanvasRenderingContext2D,
  d: DragState,
  L: LayoutMetrics,
): void {
  if (!d.wouldClear || (d.wouldClear.rows.length === 0 && d.wouldClear.cols.length === 0)) return;
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  for (const r of d.wouldClear.rows) {
    roundRect(
      ctx,
      L.boardX + L.cell * 0.06,
      L.boardY + r * L.cell + L.cell * 0.06,
      L.cell * GRID_SIZE * 0.99,
      L.cell * 0.88,
      L.cell * 0.18,
    );
    ctx.fill();
  }
  for (const c of d.wouldClear.cols) {
    roundRect(
      ctx,
      L.boardX + c * L.cell + L.cell * 0.06,
      L.boardY + L.cell * 0.06,
      L.cell * 0.88,
      L.cell * GRID_SIZE * 0.99,
      L.cell * 0.18,
    );
    ctx.fill();
  }
  ctx.restore();
}

/** Призрак фигуры в целевой позиции */
export function drawGhost(
  ctx: CanvasRenderingContext2D,
  d: DragState,
  L: LayoutMetrics,
  time = 0,
): void {
  d.piece.shape.cells.forEach(([dr, dc], i) => {
    const x = L.boardX + (d.col + dc) * L.cell;
    const y = L.boardY + (d.row + dr) * L.cell;
    if (d.piece.bomb === i && d.piece.bombTimer !== null) {
      drawBombBlock(ctx, x, y, L.cell, d.piece.bombTimer, time, 0.55);
    } else {
      drawBlock(ctx, x, y, L.cell, d.piece.color, 0.45);
    }
  });
}

/** Лоток с тремя фигурами */
export function drawTray(ctx: CanvasRenderingContext2D, g: GameState, L: LayoutMetrics): void {
  const slotW = L.W / 3;
  ctx.save();
  roundRect(ctx, 0, L.trayY - 12, L.W, L.trayH + 14, 16);
  ctx.fillStyle = "#15131d";
  ctx.fill();
  const ring = fuseFraction(g);
  for (let i = 0; i < 3; i++) {
    const piece = g.pieces[i];
    if (!piece) continue;
    if (g.drag && g.drag.slot === i) continue;
    if (g.anim && g.anim.slot === i) continue;
    const cx = slotW * (i + 0.5);
    const cy = L.trayY + L.trayH / 2;
    drawPieceAt(ctx, piece, cx, cy, L.cell, TRAY_SCALE, g.dead[i] ? 0.3 : 1, g.time, g.goalColor, ring);
  }
  ctx.restore();
}

/** Палитра огня для взрывов бомб */
export const FIRE_COLORS = ["#ff7a3d", "#ffc23d", "#ff4d4d", "#ffffff"];

/** Палитра осколков камня */
export const STONE_COLORS = ["#c3c9d4", "#9aa2b0", "#6b7280", "#3a414c"];

/** Взрыв частиц в точке (x, y) */
export function spawnBurstAt(
  particles: Particle[],
  x: number,
  y: number,
  colors: string[],
  count = 8,
): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 230;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 90,
      r: 2 + Math.random() * 3.5,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 0.55 + Math.random() * 0.3,
      maxLife: 0.85,
    });
  }
}

/** Взрыв частиц из клетки (colorIdx <= 0 → огонь бомбы) */
export function spawnBurst(
  particles: Particle[],
  L: LayoutMetrics,
  r: number,
  c: number,
  colorIdx: number,
): void {
  const cx = L.boardX + (c + 0.5) * L.cell;
  const cy = L.boardY + (r + 0.5) * L.cell;
  const colors =
    colorIdx > 0 && colorIdx <= BLOCK_COLORS.length
      ? [BLOCK_COLORS[colorIdx - 1].top, BLOCK_COLORS[colorIdx - 1].bottom, "#FFFFFF"]
      : FIRE_COLORS;
  spawnBurstAt(particles, cx, cy, colors, 7);
}

export function updateParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  dt: number,
): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    p.vy += 900 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function updateTexts(ctx: CanvasRenderingContext2D, texts: FloatText[], dt: number): void {
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    t.life -= dt;
    if (t.life <= 0) {
      texts.splice(i, 1);
      continue;
    }
    t.y -= 42 * dt;
    const age = 1 - t.life / t.maxLife;
    const alpha = Math.min(1, (t.life / t.maxLife) * 2.2);
    const scale = age < 0.18 ? 0.6 + 0.4 * (age / 0.18) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(t.x, t.y);
    ctx.scale(scale, scale);
    ctx.font = `900 ${t.size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = Math.max(3, t.size * 0.16);
    ctx.strokeText(t.text, 0, 0);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, 0, 0);
    ctx.restore();
  }
}

/** Рамка: огонь при серии, красная тревога при почти догоревшем фитиле */
export function drawFireBorder(
  ctx: CanvasRenderingContext2D,
  L: LayoutMetrics,
  time: number,
  mode: "fire" | "danger" = "fire",
): void {
  const bs = L.cell * GRID_SIZE;
  const danger = mode === "danger";
  const a = 0.45 + 0.3 * Math.sin(time * (danger ? 11 : 7));
  ctx.save();
  ctx.strokeStyle = danger ? `rgba(255,70,50,${a * 0.5})` : `rgba(255,170,60,${a * 0.5})`;
  ctx.lineWidth = 7;
  roundRect(ctx, L.boardX - 6, L.boardY - 6, bs + 12, bs + 12, 18);
  ctx.stroke();
  ctx.strokeStyle = danger ? `rgba(255,60,40,${a})` : `rgba(255,120,40,${a})`;
  ctx.lineWidth = 2.5;
  roundRect(ctx, L.boardX - 6, L.boardY - 6, bs + 12, bs + 12, 18);
  ctx.stroke();
  ctx.restore();
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Прицел молотка: пульсирующая рамка на клетке */
export function drawHammerTarget(
  ctx: CanvasRenderingContext2D,
  L: LayoutMetrics,
  r: number,
  c: number,
  time: number,
): void {
  if (r < 0 || c < 0 || r >= GRID_SIZE || c >= GRID_SIZE) return;
  const x = L.boardX + c * L.cell;
  const y = L.boardY + r * L.cell;
  const a = 0.55 + 0.35 * Math.abs(Math.sin(time * 7));
  ctx.save();
  ctx.strokeStyle = `rgba(255,90,77,${a})`;
  ctx.lineWidth = 3;
  roundRect(ctx, x + 2, y + 2, L.cell - 4, L.cell - 4, L.cell * 0.18);
  ctx.stroke();
  // уголки-акценты
  ctx.lineWidth = 5;
  const k = L.cell * 0.22;
  const corners: [number, number, number, number][] = [
    [x + 2, y + 2, 1, 1],
    [x + L.cell - 2, y + 2, -1, 1],
    [x + 2, y + L.cell - 2, 1, -1],
    [x + L.cell - 2, y + L.cell - 2, -1, -1],
  ];
  ctx.beginPath();
  for (const [cx, cy, dx, dy] of corners) {
    ctx.moveTo(cx + dx * k, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * k);
  }
  ctx.stroke();
  ctx.restore();
}

/** Есть ли бомба, у которой фитиль почти догорел (тревога) */
export function hasLowBomb(g: GameState, threshold = 2): boolean {
  for (const row of g.grid) {
    for (const v of row) {
      if (v < 0 && v >= -threshold) return true;
    }
  }
  for (const p of g.pieces) {
    if (p && p.bombTimer !== null && p.bombTimer <= threshold) return true;
  }
  return false;
}
