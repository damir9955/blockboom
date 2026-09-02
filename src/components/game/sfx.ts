// ── Звук (WebAudio, синтез без файлов) и вибрация ───────────────────────────

export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  private ensure(): AudioContext | null {
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        this.ctx = new Ctor();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
    slideTo?: number,
  ): void {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    }
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  pickup(): void {
    this.tone(560, 0.06, "sine", 0.05);
  }

  place(): void {
    this.tone(190, 0.09, "triangle", 0.12, 0, 280);
  }

  /** Глухой тык — фигуру вернули в лоток / некуда ставить */
  bump(): void {
    this.tone(150, 0.1, "sawtooth", 0.04, 0, 90);
  }

  /** Восходящее арпеджио: чем больше линий и серия — тем выше тон */
  clear(lines: number, streak: number): void {
    const base = 392 * Math.pow(1.06, Math.min(streak, 10));
    const notes = Math.min(lines, 4) + 1;
    for (let i = 0; i < notes; i++) {
      this.tone(base * Math.pow(1.2599, i), 0.14, "triangle", 0.1, i * 0.07);
    }
    this.tone(base * 2, 0.25, "sine", 0.06, notes * 0.07);
  }

  over(): void {
    this.tone(330, 0.3, "triangle", 0.1, 0, 262);
    this.tone(262, 0.3, "triangle", 0.1, 0.25, 196);
    this.tone(196, 0.5, "triangle", 0.1, 0.5, 98);
  }

  /** Тревожный тик: где-то фитиль почти догорел */
  tick(): void {
    this.tone(1250, 0.03, "square", 0.035);
    this.tone(950, 0.03, "square", 0.028, 0.06);
  }

  /** Обезвреживание бомбы */
  defuse(): void {
    this.tone(880, 0.12, "sine", 0.09);
    this.tone(1318, 0.2, "sine", 0.08, 0.08);
  }

  /** Появление полевой бомбы — тревожный двойной сигнал */
  bombSpawn(): void {
    this.tone(622, 0.09, "square", 0.05);
    this.tone(494, 0.14, "square", 0.05, 0.1);
    this.tone(622, 0.09, "square", 0.04, 0.22);
  }

  /** Победа — фанфара до-ми-соль-до */
  win(): void {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this.tone(f, 0.22, "triangle", 0.1, i * 0.11));
    this.tone(1319, 0.4, "sine", 0.06, notes.length * 0.11);
  }

  /** Уровень провален — нисходящая грусть */
  fail(): void {
    this.tone(392, 0.25, "triangle", 0.1, 0, 330);
    this.tone(330, 0.25, "triangle", 0.1, 0.22, 262);
    this.tone(262, 0.45, "triangle", 0.1, 0.44, 175);
  }

  /** Звезда в оверлее победы */
  star(): void {
    this.tone(880, 0.1, "sine", 0.08);
    this.tone(1318, 0.16, "sine", 0.07, 0.07);
  }

  /** Монеты */
  coin(): void {
    this.tone(988, 0.07, "square", 0.045);
    this.tone(1319, 0.12, "square", 0.04, 0.06);
  }

  /** Удар молотка */
  hammer(): void {
    this.tone(150, 0.09, "sine", 0.16, 0, 60);
    this.tone(700, 0.04, "square", 0.05);
  }

  /** Камень треснул от удара линии (destroyed — окончательно рассыпался) */
  stoneCrack(destroyed = false): void {
    if (destroyed) {
      this.tone(170, 0.12, "triangle", 0.16, 0, 55);
      this.tone(75, 0.18, "sine", 0.13, 0.05, 38);
      this.tone(240, 0.06, "square", 0.04, 0.02);
    } else {
      this.tone(210, 0.07, "triangle", 0.13, 0, 95);
      this.tone(95, 0.09, "sine", 0.09, 0.03, 55);
    }
  }

  /** Перемешивание лотка */
  shuffle(): void {
    this.tone(300, 0.16, "sawtooth", 0.03, 0, 900);
  }

  /** Взрыв бомбы — шумовой хлопок с падающим фильтром */
  explode(): void {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const dur = 0.55;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const k = 1 - i / data.length;
      data[i] = (Math.random() * 2 - 1) * k * k;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(1100, ctx.currentTime);
    filt.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.4, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(ctx.destination);
    src.start();
  }
}

export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // игнорируем — не все устройства поддерживают
  }
}
