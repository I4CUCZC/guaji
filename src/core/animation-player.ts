import type { FrameDef, StateDef } from './types';

export type FrameCallback = (frame: FrameDef, frameIndex: number, stateId: string) => void;

/**
 * Lightweight frame-based animation player.
 * No game engine — just requestAnimationFrame + JSON frames.
 */
export class AnimationPlayer {
  private state: StateDef | null = null;
  private frameIndex = 0;
  private elapsedInFrame = 0;
  private lastTs = 0;
  private running = false;
  private rafId = 0;
  private onFrame: FrameCallback | null = null;

  setOnFrame(cb: FrameCallback): void {
    this.onFrame = cb;
  }

  play(state: StateDef): void {
    this.state = state;
    this.frameIndex = 0;
    this.elapsedInFrame = 0;
    this.lastTs = 0;
    this.emit();
    if (!this.running) {
      this.running = true;
      this.rafId = requestAnimationFrame((t) => this.tick(t));
    }
  }

  stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  getCurrentStateId(): string | null {
    return this.state?.id ?? null;
  }

  private frameDuration(frame: FrameDef, state: StateDef): number {
    if (frame.durationMs != null) return frame.durationMs;
    const fps = state.fps ?? 8;
    return 1000 / fps;
  }

  private emit(): void {
    if (!this.state || !this.onFrame) return;
    const frames = this.state.frames;
    if (!frames.length) return;
    const frame = frames[this.frameIndex]!;
    this.onFrame(frame, this.frameIndex, this.state.id);
  }

  private tick(ts: number): void {
    if (!this.running || !this.state) return;
    if (!this.lastTs) this.lastTs = ts;
    const dt = ts - this.lastTs;
    this.lastTs = ts;

    const frames = this.state.frames;
    if (!frames.length) {
      this.rafId = requestAnimationFrame((t) => this.tick(t));
      return;
    }

    this.elapsedInFrame += dt;
    let dur = this.frameDuration(frames[this.frameIndex]!, this.state);

    while (this.elapsedInFrame >= dur) {
      this.elapsedInFrame -= dur;
      const loop = this.state.loop !== false;
      if (this.frameIndex + 1 >= frames.length) {
        if (loop) {
          this.frameIndex = 0;
        } else {
          this.frameIndex = frames.length - 1;
          this.emit();
          this.rafId = requestAnimationFrame((t) => this.tick(t));
          return;
        }
      } else {
        this.frameIndex += 1;
      }
      this.emit();
      dur = this.frameDuration(frames[this.frameIndex]!, this.state);
    }

    this.rafId = requestAnimationFrame((t) => this.tick(t));
  }
}
