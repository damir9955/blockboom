// ── Отрисовка на canvas: поле, блоки, частицы, тексты ──────────────────────

import { BLOCK_COLORS, GRID_SIZE, type Grid, type Piece } from "./engine";

export const TRAY_SCALE = 0.55;

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
  /** секунды без ходов — фитиль тикает и по времени */
  idleAcc: number;
  /** сколько блоков цвета цели убрано (для цели «собери») */
  collected: number;
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

/** Один «конфетный» блок с градиентом и блеском */
export function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  colorIdx: number,
  alpha = 1,
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
  ctx.restore();
}

/** Бомба: тёмный блок с фитилём и таймером */
export function drawBombBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  timer: number,
  time: number,
  alpha = 1,
): void {
  const pad = s * 0.05;
  const r = s * 0.22;
  const urgent = timer <= 2;
  const pulse = urgent ? 1 + 0.07 * Math.sin(time * 12) : 1;
  const size = (s - pad * 2) * pulse;
  const bx = x + (s - size) / 2;
  const by = y + (s - size) / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  const grad = ctx.createLinearGradient(0, by, 0, by + size);
  grad.addColorStop(0, "#4a4457");
  grad.addColorStop(1, "#221d2c");
  ctx.fillStyle = grad;
  roundRect(ctx, bx, by, size, size, r);
  ctx.fill();
  ctx.strokeStyle = urgent ? "rgba(255,90,60,0.95)" : "rgba(255,255,255,0.14)";
  ctx.lineWidth = Math.max(1.5, s * 0.045);
  roundRect(ctx, bx, by, size, size, r);
  ctx.stroke();
  // искра на фитиле
  ctx.fillStyle = urgent ? "#ffd34d" : "#ffb14d";
  ctx.beginPath();
  const sparkR = s * (urgent ? 0.075 + 0.02 * Math.abs(Math.sin(time * 10)) : 0.06);
  ctx.arc(x + s / 2, by + size * 0.22, sparkR, 0, Math.PI * 2);
  ctx.fill();
  // таймер
  ctx.fillStyle = urgent ? "#ff6a4d" : "#f4f0ff";
  ctx.font = `900 ${Math.round(s * 0.42)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(Math.max(0, timer)), x + s / 2, y + s / 2 + s * 0.06);
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
): void {
  const w = piece.shape.w * cell * scale;
  const h = piece.shape.h * cell * scale;
  const x0 = cx - w / 2;
  const y0 = cy - h / 2;
  piece.shape.cells.forEach(([dr, dc], i) => {
    const x = x0 + dc * cell * scale;
    const y = y0 + dr * cell * scale;
    if (piece.bomb === i && piece.bombTimer !== null) {
      drawBombBlock(ctx, x, y, cell * scale, piece.bombTimer, time, alpha);
    } else {
      drawBlock(ctx, x, y, cell * scale, piece.color, alpha);
    }
  });
}

/** Поле с подложкой, пустыми клетками и «поп»-анимацией новых блоков */
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
        const off = (1 - sc) * L.cell / 2;
        if (v < 0) {
          drawBombBlock(ctx, x + off, y + off, L.cell * sc, -v, g.time, 1);
        } else {
          drawBlock(ctx, x + off, y + off, L.cell * sc, v, 1);
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
  for (let i = 0; i < 3; i++) {
    const piece = g.pieces[i];
    if (!piece) continue;
    if (g.drag && g.drag.slot === i) continue;
    if (g.anim && g.anim.slot === i) continue;
    const cx = slotW * (i + 0.5);
    const cy = L.trayY + L.trayH / 2;
    drawPieceAt(ctx, piece, cx, cy, L.cell, TRAY_SCALE, g.dead[i] ? 0.3 : 1, g.time);
  }
  ctx.restore();
}

/** Палитра огня для взрывов бомб */
export const FIRE_COLORS = ["#ff7a3d", "#ffc23d", "#ff4d4d", "#ffffff"];

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
