// ── Отрисовка на canvas: реалистичные глянцевые блоки (спрайт-кэш),
//    доска-лоток с «гнёздами», бомбы с фитилём, камень, частицы со свечением ─

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
  const pad = 12;
  const cell = (w - pad * 2) / GRID_SIZE;
  const gap = 28;
  const trayH = Math.max(92, cell * 2.3);
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
  /** сколько камней разбито (для цели «камни») */
  stonesBroken: number;
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

// ── Помощники цвета: светлее/темнее hex ──────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** f > 1 — светлее, f < 1 — темнее (линейно по каналам) */
function shade(hex: string, f: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * f + (f > 1 ? (255 - r) * (f - 1) * 0.55 : 0), g * f + (f > 1 ? (255 - g) * (f - 1) * 0.55 : 0), b * f + (f > 1 ? (255 - b) * (f - 1) * 0.55 : 0));
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ── Текстура шума (один раз на сессию) ───────────────────────────────────────

let noiseTile: HTMLCanvasElement | null = null;

function getNoisePattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (noiseTile) {
    const p = ctx.createPattern(noiseTile, "repeat");
    return p;
  }
  try {
    const cv = document.createElement("canvas");
    cv.width = 96;
    cv.height = 96;
    const c = cv.getContext("2d");
    if (!c) return null;
    const img = c.createImageData(96, 96);
    for (let i = 0; i < img.data.length; i += 4) {
      // мелкое зерно: значения вокруг средней яркости
      const v = 118 + (Math.random() * 2 - 1) * 42;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    noiseTile = cv;
    return ctx.createPattern(cv, "repeat");
  } catch {
    return null;
  }
}

// ── Спрайт-кэш глянцевых блоков ──────────────────────────────────────────────

const SPRITE_SS = 2; // суперсэмплинг: рендерим в 2× и уменьшаем при выводе
const blockSprites = new Map<string, HTMLCanvasElement>();

/** квантование размера в бакеты по 2px — кэш не взрывается при анимациях */
function bucket(s: number): number {
  return Math.max(8, Math.round(s / 2) * 2);
}

function colorAt(colorIdx: number): { top: string; bottom: string } {
  return BLOCK_COLORS[
    ((colorIdx - 1) % BLOCK_COLORS.length + BLOCK_COLORS.length) % BLOCK_COLORS.length
  ];
}

/** Отрисовка «леденцового» блока: каплевидный блик, фаска, шум, контактная тень */
function renderBlockSprite(colorIdx: number, q: number): HTMLCanvasElement {
  const col = colorAt(colorIdx);
  const cv = document.createElement("canvas");
  const res = q * SPRITE_SS;
  cv.width = res;
  cv.height = res;
  const c = cv.getContext("2d");
  if (!c) return cv;
  c.scale(SPRITE_SS, SPRITE_SS);

  const pad = q * 0.04;
  const r = q * 0.26;
  const w = q - pad * 2;
  const bx = pad;
  const by = pad;
  const body = (): void => roundRect(c, bx, by, w, w, r);

  // 1. контактная тень (слоёная — «мягкая»)
  c.fillStyle = "rgba(0,0,0,0.30)";
  roundRect(c, bx + 1, by + q * 0.05, w - 2, w, r);
  c.fill();
  c.fillStyle = "rgba(0,0,0,0.16)";
  roundRect(c, bx + 0.5, by + q * 0.028, w - 1, w, r);
  c.fill();

  // 2. корпус — 5-стоповый вертикальный градиент
  const g = c.createLinearGradient(0, by, 0, by + w);
  g.addColorStop(0, shade(col.top, 1.22));
  g.addColorStop(0.18, shade(col.top, 1.07));
  g.addColorStop(0.5, col.top);
  g.addColorStop(0.82, col.bottom);
  g.addColorStop(1, shade(col.bottom, 0.74));
  c.fillStyle = g;
  body();
  c.fill();

  // обрезка корпуса — всё дальнейшее внутри
  c.save();
  body();
  c.clip();

  // 3. внутренняя тень снизу (объём)
  const bi = c.createLinearGradient(0, by + w * 0.62, 0, by + w);
  bi.addColorStop(0, "rgba(0,0,0,0)");
  bi.addColorStop(1, "rgba(0,0,0,0.26)");
  c.fillStyle = bi;
  c.fillRect(bx, by + w * 0.62, w, w * 0.38);

  // 4. верхний глянцевый пояс
  const tg = c.createLinearGradient(0, by, 0, by + w * 0.46);
  tg.addColorStop(0, "rgba(255,255,255,0.60)");
  tg.addColorStop(0.5, "rgba(255,255,255,0.20)");
  tg.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = tg;
  roundRect(c, bx + w * 0.06, by + w * 0.045, w * 0.88, w * 0.42, r * 0.55);
  c.fill();

  // 5. диагональный блик-полоса (спекуляр)
  c.save();
  c.translate(bx + w * 0.34, by + w * 0.2);
  c.rotate(-0.55);
  const sp = c.createLinearGradient(0, -w * 0.05, 0, w * 0.05);
  sp.addColorStop(0, "rgba(255,255,255,0)");
  sp.addColorStop(0.5, "rgba(255,255,255,0.42)");
  sp.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = sp;
  c.beginPath();
  c.ellipse(0, 0, w * 0.3, w * 0.075, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
  // искра-точка
  c.fillStyle = "rgba(255,255,255,0.55)";
  c.beginPath();
  c.ellipse(bx + w * 0.26, by + w * 0.16, w * 0.05, w * 0.035, -0.5, 0, Math.PI * 2);
  c.fill();

  // 6. зерно (микротекстура пластика)
  const noise = getNoisePattern(c);
  if (noise) {
    c.save();
    c.globalCompositeOperation = "overlay";
    c.globalAlpha = 0.09;
    c.fillStyle = noise;
    c.fillRect(0, 0, q, q);
    c.restore();
  }

  c.restore(); // конец обрезки корпуса

  // 7. светящаяся фаска: градиентная обводка (свет сверху-слева)
  const rim = c.createLinearGradient(bx, by, bx + w, by + w);
  rim.addColorStop(0, "rgba(255,255,255,0.55)");
  rim.addColorStop(0.45, "rgba(255,255,255,0.10)");
  rim.addColorStop(0.8, "rgba(255,255,255,0)");
  rim.addColorStop(1, "rgba(255,255,255,0.18)");
  c.strokeStyle = rim;
  c.lineWidth = Math.max(1, q * 0.035);
  body();
  c.stroke();

  // 8. внешняя тонкая тёмная окантовка
  c.strokeStyle = "rgba(10,8,16,0.35)";
  c.lineWidth = Math.max(1, q * 0.022);
  body();
  c.stroke();

  return cv;
}

function blockSprite(colorIdx: number, s: number): HTMLCanvasElement {
  const q = bucket(s);
  const key = `${colorIdx}:${q}`;
  let spr = blockSprites.get(key);
  if (!spr) {
    spr = renderBlockSprite(colorIdx, q);
    blockSprites.set(key, spr);
  }
  return spr;
}

/** Один «леденцовый» блок: глянец, фаска, блик, тень, микрозерно.
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
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(blockSprite(colorIdx, s), x, y, s, s);
  if (highlight) {
    const wave = 0.55 + 0.45 * Math.sin(performance.now() / 300);
    const q = bucket(s);
    const pad = q * 0.04;
    const w = s - pad * 2;
    ctx.strokeStyle = `rgba(255,255,255,${(alpha * (0.55 + 0.4 * wave)).toFixed(3)})`;
    ctx.lineWidth = Math.max(1.5, s * 0.075);
    roundRect(ctx, x + pad, y + pad, w, w, s * 0.26);
    ctx.stroke();
    // мягкое свечение вокруг блока цели
    ctx.strokeStyle = `rgba(255,246,180,${(alpha * 0.3 * wave).toFixed(3)})`;
    ctx.lineWidth = Math.max(2, s * 0.11);
    roundRect(ctx, x + pad * 0.4, y + pad * 0.4, s - pad * 0.8, s - pad * 0.8, s * 0.28);
    ctx.stroke();
  }
  ctx.restore();
}

// ── Камень (спрайт-кэш, 2 стадии) ───────────────────────────────────────────

const stoneSprites = new Map<string, HTMLCanvasElement>();

function renderStoneSprite(stage: number, q: number): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  const res = q * SPRITE_SS;
  cv.width = res;
  cv.height = res;
  const c = cv.getContext("2d");
  if (!c) return cv;
  c.scale(SPRITE_SS, SPRITE_SS);

  const pad = q * 0.05;
  const r = q * 0.2;
  const inner = q - pad * 2;

  // тень
  c.fillStyle = "rgba(0,0,0,0.30)";
  roundRect(c, pad + 1, pad + q * 0.05, inner - 2, inner, r);
  c.fill();

  // гранит: холодный градиент + крапинки
  const grad = c.createLinearGradient(0, pad, 0, pad + inner);
  if (stage >= 1) {
    grad.addColorStop(0, "#7d8492");
    grad.addColorStop(0.5, "#575e6a");
    grad.addColorStop(1, "#39404b");
  } else {
    grad.addColorStop(0, "#99a0ae");
    grad.addColorStop(0.5, "#6f7684");
    grad.addColorStop(1, "#4d545f");
  }
  c.fillStyle = grad;
  roundRect(c, pad, pad, inner, inner, r);
  c.fill();

  c.save();
  roundRect(c, pad, pad, inner, inner, r);
  c.clip();

  // минеральные крапинки
  const dots = stage >= 1 ? 26 : 40;
  for (let i = 0; i < dots; i++) {
    const dx = pad + Math.random() * inner;
    const dy = pad + Math.random() * inner;
    const dr = inner * (0.008 + Math.random() * 0.02);
    c.fillStyle =
      Math.random() < 0.5 ? "rgba(255,255,255,0.10)" : "rgba(20,22,30,0.22)";
    c.beginPath();
    c.arc(dx, dy, dr, 0, Math.PI * 2);
    c.fill();
  }

  // блик сверху (у целого — ярче и глянец)
  const gloss = c.createLinearGradient(0, pad, 0, pad + inner * 0.42);
  gloss.addColorStop(0, `rgba(255,255,255,${stage >= 1 ? 0.14 : 0.30})`);
  gloss.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = gloss;
  roundRect(c, pad + inner * 0.08, pad + inner * 0.06, inner * 0.84, inner * 0.3, r * 0.5);
  c.fill();

  if (stage >= 1) {
    // ── сеть трещин по всему камню ──
    c.strokeStyle = "rgba(10,9,14,0.8)";
    c.lineWidth = Math.max(1.5, q * 0.05);
    c.lineCap = "round";
    c.lineJoin = "round";
    const cracks: [number, number][][] = [
      [[0.16, 0.1], [0.38, 0.34], [0.3, 0.62], [0.52, 0.9]],
      [[0.86, 0.22], [0.62, 0.48], [0.78, 0.72]],
      [[0.1, 0.7], [0.34, 0.52], [0.28, 0.28]],
      [[0.7, 0.06], [0.58, 0.3], [0.74, 0.46]],
      [[0.3, 0.94], [0.46, 0.72], [0.66, 0.88]],
      [[0.06, 0.4], [0.26, 0.46], [0.2, 0.64]],
      [[0.52, 0.48], [0.44, 0.18]],
      [[0.52, 0.48], [0.66, 0.36]],
      [[0.52, 0.48], [0.4, 0.7]],
      [[0.52, 0.48], [0.7, 0.6]],
      [[0.52, 0.48], [0.6, 0.82]],
      [[0.52, 0.48], [0.34, 0.44]],
      [[0.38, 0.34], [0.52, 0.2]],
      [[0.62, 0.48], [0.56, 0.62]],
      [[0.34, 0.52], [0.48, 0.44]],
      [[0.46, 0.72], [0.34, 0.8]],
      [[0.58, 0.3], [0.66, 0.2]],
    ];
    c.beginPath();
    for (const line of cracks) {
      c.moveTo(pad + line[0][0] * inner, pad + line[0][1] * inner);
      for (let i = 1; i < line.length; i++) {
        c.lineTo(pad + line[i][0] * inner, pad + line[i][1] * inner);
      }
    }
    c.stroke();
    c.strokeStyle = "rgba(10,9,14,0.55)";
    c.lineWidth = Math.max(1, q * 0.032);
    const hair: [number, number][][] = [
      [[0.44, 0.18], [0.36, 0.1]],
      [[0.66, 0.36], [0.78, 0.34]],
      [[0.4, 0.7], [0.32, 0.62]],
      [[0.7, 0.6], [0.82, 0.54]],
      [[0.6, 0.82], [0.66, 0.9]],
      [[0.26, 0.46], [0.18, 0.4]],
      [[0.78, 0.72], [0.84, 0.8]],
    ];
    c.beginPath();
    for (const line of hair) {
      c.moveTo(pad + line[0][0] * inner, pad + line[0][1] * inner);
      c.lineTo(pad + line[1][0] * inner, pad + line[1][1] * inner);
    }
    c.stroke();
    // сколотые уголки
    c.fillStyle = "rgba(20,19,26,0.55)";
    const chip = (pts: [number, number][]): void => {
      c.beginPath();
      c.moveTo(pad + pts[0][0] * inner, pad + pts[0][1] * inner);
      for (let i = 1; i < pts.length; i++)
        c.lineTo(pad + pts[i][0] * inner, pad + pts[i][1] * inner);
      c.closePath();
      c.fill();
    };
    chip([[0, 0.16], [0.16, 0], [0.3, 0.05], [0.08, 0.26]]);
    chip([[0.98, 0.84], [0.82, 1], [0.66, 0.96]]);
    chip([[0.06, 0.98], [0.2, 0.94], [0.1, 0.8]]);
    // крошки-точки
    c.fillStyle = "rgba(15,14,20,0.5)";
    for (const [dx, dy, dr] of [
      [0.24, 0.24, 0.025],
      [0.76, 0.3, 0.02],
      [0.64, 0.66, 0.025],
      [0.3, 0.8, 0.02],
      [0.5, 0.58, 0.018],
    ] as [number, number, number][]) {
      c.beginPath();
      c.arc(pad + dx * inner, pad + dy * inner, dr * inner, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();

  // фаска и окантовка
  c.strokeStyle = "rgba(0,0,0,0.42)";
  c.lineWidth = Math.max(1, q * 0.045);
  roundRect(c, pad, pad, inner, inner, r);
  c.stroke();
  return cv;
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
  const q = bucket(s);
  const key = `st${stage}:${q}`;
  let spr = stoneSprites.get(key);
  if (!spr) {
    spr = renderStoneSprite(stage, q);
    stoneSprites.set(key, spr);
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(spr, x, y, s, s);
  ctx.restore();
}

// ── Бомба: металлическая сфера с фитилём-искрой и цифрой ────────────────────

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

  // подложка-«гнездо»
  const backGrad = ctx.createLinearGradient(0, y, 0, y + s);
  backGrad.addColorStop(0, urgent ? "#2b151c" : "#1c1826");
  backGrad.addColorStop(1, urgent ? "#170d12" : "#120f1a");
  ctx.fillStyle = backGrad;
  roundRect(ctx, x + s * 0.05, y + s * 0.05, s * 0.9, s * 0.9, s * 0.18);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  roundRect(ctx, x + s * 0.05, y + s * 0.05, s * 0.9, s * 0.9, s * 0.18);
  ctx.stroke();

  const cx = x + s / 2;
  const cy = y + s * 0.62;
  const br = s * 0.34 * pulse;

  // контактная тень сферы
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + br * 0.82, br * 0.85, br * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // свечение при срочности
  if (urgent) {
    const glow = ctx.createRadialGradient(cx, cy, br * 0.6, cx, cy, br * 2.1);
    glow.addColorStop(0, "rgba(255,70,40,0.30)");
    glow.addColorStop(1, "rgba(255,70,40,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, br * 2.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // сфера: металл с бликом
  const grad = ctx.createRadialGradient(cx - br * 0.35, cy - br * 0.45, br * 0.1, cx, cy, br);
  grad.addColorStop(0, "#6a6178");
  grad.addColorStop(0.35, "#453d55");
  grad.addColorStop(0.7, "#2a2338");
  grad.addColorStop(1, "#171122");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, br, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = urgent ? "rgba(255,90,60,0.95)" : "rgba(255,255,255,0.18)";
  ctx.lineWidth = Math.max(1.2, s * 0.04);
  ctx.stroke();

  // широкий блик на сфере (глинт)
  ctx.fillStyle = "rgba(255,255,255,0.26)";
  ctx.beginPath();
  ctx.ellipse(cx - br * 0.38, cy - br * 0.48, br * 0.32, br * 0.2, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.ellipse(cx - br * 0.42, cy - br * 0.52, br * 0.1, br * 0.06, -0.6, 0, Math.PI * 2);
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

// ── Фигуры ──────────────────────────────────────────────────────────────────

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

// ── Доска: кэш фона (рама-лоток + гнёзда + свет) ────────────────────────────

let boardBgCache: { key: string; cv: HTMLCanvasElement } | null = null;

function renderBoardBg(L: LayoutMetrics): HTMLCanvasElement {
  const bs = L.cell * GRID_SIZE;
  const m = 10; // поля рамы вокруг сетки
  const size = bs + m * 2;
  const res = Math.round(size * L.dpr);
  const cv = document.createElement("canvas");
  cv.width = res;
  cv.height = res;
  const c = cv.getContext("2d");
  if (!c) return cv;
  c.scale(res / size, res / size);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";

  // внешняя рама-лоток: тёмный лак с бликом по верхней кромке
  const frame = c.createLinearGradient(0, 0, 0, size);
  frame.addColorStop(0, "#2e2939");
  frame.addColorStop(0.12, "#252130");
  frame.addColorStop(1, "#17141f");
  c.fillStyle = frame;
  roundRect(c, 0, 0, size, size, 22);
  c.fill();
  // верхний свет на раме
  const fh = c.createLinearGradient(0, 0, 0, 14);
  fh.addColorStop(0, "rgba(255,255,255,0.22)");
  fh.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = fh;
  roundRect(c, 0, 0, size, 14, 22);
  c.fill();
  c.strokeStyle = "rgba(255,255,255,0.09)";
  c.lineWidth = 1.5;
  roundRect(c, 0.75, 0.75, size - 1.5, size - 1.5, 21.5);
  c.stroke();
  // тень рамы наружу
  c.strokeStyle = "rgba(0,0,0,0.45)";
  c.lineWidth = 4;
  roundRect(c, -2, -2, size + 4, size + 4, 24);
  c.stroke();

  // внутренняя «воронка» — углубление
  const well = c.createLinearGradient(0, m, 0, m + bs);
  well.addColorStop(0, "#0e0c14");
  well.addColorStop(0.25, "#141119");
  well.addColorStop(1, "#191521");
  c.fillStyle = well;
  roundRect(c, m - 4, m - 4, bs + 8, bs + 8, 16);
  c.fill();
  // внутренняя тень сверху (глубина)
  c.save();
  roundRect(c, m - 4, m - 4, bs + 8, bs + 8, 16);
  c.clip();
  const inset = c.createLinearGradient(0, m - 4, 0, m + 14);
  inset.addColorStop(0, "rgba(0,0,0,0.5)");
  inset.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = inset;
  c.fillRect(m - 4, m - 4, bs + 8, 18);
  const insetB = c.createLinearGradient(0, m + bs - 10, 0, m + bs + 4);
  insetB.addColorStop(0, "rgba(255,255,255,0)");
  insetB.addColorStop(1, "rgba(255,255,255,0.045)");
  c.fillStyle = insetB;
  c.fillRect(m - 4, m + bs - 10, bs + 8, 14);

  // гнёзда клеток
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const x = m + col * L.cell;
      const y = m + r * L.cell;
      const inx = L.cell * 0.07;
      const w = L.cell - inx * 2;
      const socket = c.createLinearGradient(0, y, 0, y + L.cell);
      socket.addColorStop(0, "rgba(0,0,0,0.30)");
      socket.addColorStop(0.5, "rgba(0,0,0,0.10)");
      socket.addColorStop(1, "rgba(255,255,255,0.035)");
      c.fillStyle = socket;
      roundRect(c, x + inx, y + inx, w, w, L.cell * 0.17);
      c.fill();
      c.strokeStyle = "rgba(0,0,0,0.28)";
      c.lineWidth = 1;
      roundRect(c, x + inx, y + inx, w, w, L.cell * 0.17);
      c.stroke();
    }
  }

  // мягкий студийный свет сверху-слева
  const amb = c.createRadialGradient(bs * 0.28, -bs * 0.3, 0, bs * 0.28, -bs * 0.3, bs * 1.15);
  amb.addColorStop(0, "rgba(180,190,255,0.075)");
  amb.addColorStop(1, "rgba(180,190,255,0)");
  c.fillStyle = amb;
  c.fillRect(m - 4, m - 4, bs + 8, bs + 8);
  // лёгкая виньетка по краям
  const vig = c.createRadialGradient(size / 2, size / 2, bs * 0.35, size / 2, size / 2, bs * 0.78);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.22)");
  c.fillStyle = vig;
  c.fillRect(m - 4, m - 4, bs + 8, bs + 8);
  c.restore();

  return cv;
}

function boardBg(L: LayoutMetrics): HTMLCanvasElement {
  const key = `${Math.round(L.W)}|${Math.round(L.cell * 4)}|${L.dpr.toFixed(2)}`;
  if (!boardBgCache || boardBgCache.key !== key) {
    boardBgCache = { key, cv: renderBoardBg(L) };
  }
  return boardBgCache.cv;
}

/** Поле: рама-лоток (кэш), пустые гнёзда, бомбы и камни */
export function drawBoard(ctx: CanvasRenderingContext2D, g: GameState, L: LayoutMetrics): void {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const bg = boardBg(L);
  const bs = L.cell * GRID_SIZE;
  ctx.drawImage(bg, L.boardX - 10, L.boardY - 10, bs + 20, bs + 20);

  const popMap = new Map<number, number>();
  for (const p of g.pops) popMap.set(p.r * 100 + p.c, p.t);
  const ring = fuseFraction(g);

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const x = L.boardX + c * L.cell;
      const y = L.boardY + r * L.cell;
      const v = g.grid[r][c];
      if (v === 0) continue;
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
  ctx.globalCompositeOperation = "lighter";
  const t = performance.now() / 260;
  const a = 0.12 + 0.06 * Math.sin(t);
  const grad = ctx.createLinearGradient(0, L.boardY, 0, L.boardY + L.cell * GRID_SIZE);
  grad.addColorStop(0, `rgba(255,255,255,${(a + 0.05).toFixed(3)})`);
  grad.addColorStop(0.5, `rgba(255,244,190,${a.toFixed(3)})`);
  grad.addColorStop(1, `rgba(255,255,255,${(a + 0.05).toFixed(3)})`);
  ctx.fillStyle = grad;
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
      drawBlock(ctx, x, y, L.cell, d.piece.color, 0.42);
      // призрачная рамка-контур
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.2 * Math.sin(time * 6);
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = Math.max(1.5, L.cell * 0.045);
      roundRect(ctx, x + L.cell * 0.09, y + L.cell * 0.09, L.cell * 0.82, L.cell * 0.82, L.cell * 0.2);
      ctx.stroke();
      ctx.restore();
    }
  });
}

/** Лоток с тремя фигурами — стеклянная полка */
export function drawTray(ctx: CanvasRenderingContext2D, g: GameState, L: LayoutMetrics): void {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // стеклянная полка с бликом сверху
  const shelf = ctx.createLinearGradient(0, L.trayY - 12, 0, L.trayY + L.trayH + 6);
  shelf.addColorStop(0, "rgba(56,50,72,0.85)");
  shelf.addColorStop(0.18, "rgba(32,28,44,0.9)");
  shelf.addColorStop(1, "rgba(16,14,22,0.95)");
  ctx.fillStyle = shelf;
  roundRect(ctx, 0, L.trayY - 12, L.W, L.trayH + 14, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 3;
  roundRect(ctx, -1.5, L.trayY - 13.5, L.W + 3, L.trayH + 17, 19);
  ctx.stroke();
  // верхний глянцевый кант полки
  const hl = ctx.createLinearGradient(0, L.trayY - 12, 0, L.trayY + 4);
  hl.addColorStop(0, "rgba(255,255,255,0.16)");
  hl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = hl;
  roundRect(ctx, 1, L.trayY - 11, L.W - 2, 15, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, L.trayY - 11.5, L.W - 1, L.trayH + 13, 17.5);
  ctx.stroke();

  const ring = fuseFraction(g);
  for (let i = 0; i < 3; i++) {
    const piece = g.pieces[i];
    if (!piece) continue;
    if (g.drag && g.drag.slot === i) continue;
    if (g.anim && g.anim.slot === i) continue;
    const cx = (L.W / 3) * (i + 0.5);
    const cy = L.trayY + L.trayH / 2;
    // мёртвая (некуда поставить) фигура — приглушаем
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

/** Частицы: светящиеся угольки (аддитивное свечение + ядро) */
export function updateParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  dt: number,
): void {
  if (particles.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
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
    const a = Math.max(0, Math.min(1, p.life / p.maxLife));
    const gr = p.r * 2.6;
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, gr);
    glow.addColorStop(0, rgba(p.color.startsWith("#") ? p.color : "#ffaa55", 0.55 * a));
    glow.addColorStop(0.45, rgba(p.color.startsWith("#") ? p.color : "#ffaa55", 0.22 * a));
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, gr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.color;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
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
    // объёмная обводка + свечение цвета
    ctx.shadowColor = t.color;
    ctx.shadowBlur = t.size * 0.35;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = Math.max(3, t.size * 0.18);
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
  ctx.globalCompositeOperation = "lighter";
  // широкое мягкое свечение
  const glow = ctx.createRadialGradient(L.boardX + bs / 2, L.boardY + bs / 2, bs * 0.35, L.boardX + bs / 2, L.boardY + bs / 2, bs * 0.75);
  glow.addColorStop(0, "rgba(0,0,0,0)");
  glow.addColorStop(1, danger ? `rgba(255,60,40,${(a * 0.22).toFixed(3)})` : `rgba(255,140,40,${(a * 0.22).toFixed(3)})`);
  ctx.fillStyle = glow;
  ctx.fillRect(L.boardX - 14, L.boardY - 14, bs + 28, bs + 28);
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
