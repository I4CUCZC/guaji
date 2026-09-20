import type {
  CharacterDef,
  CompanionBridge,
  CompanionInputEvent,
  FrameDef,
} from './types';
import { AnimationPlayer } from './animation-player';
import { ReactionEngine } from './reaction-engine';

export interface CompanionOptions {
  character: CharacterDef;
  /** Resolve asset path relative to character root → absolute URL or inline SVG */
  resolveAsset: (src: string) => string;
  /** Called whenever the visible frame changes */
  onFrame: (frame: FrameDef, frameIndex: number, stateId: string, resolvedSrc: string) => void;
  onStateChange?: (stateId: string) => void;
  bridge?: CompanionBridge;
}

/**
 * Portable companion controller.
 * Wire it to canvas/DOM in the renderer; Electron only forwards input via bridge.
 */
export class Companion {
  private player: AnimationPlayer;
  private engine: ReactionEngine;
  private resolveAsset: CompanionOptions['resolveAsset'];
  private onFrame: CompanionOptions['onFrame'];
  private unsubInput: (() => void) | null = null;

  constructor(opts: CompanionOptions) {
    this.resolveAsset = opts.resolveAsset;
    this.onFrame = opts.onFrame;
    this.player = new AnimationPlayer();
    this.player.setOnFrame((frame, idx, stateId) => {
      this.onFrame(frame, idx, stateId, this.resolveAsset(frame.src));
    });
    this.engine = new ReactionEngine(opts.character, this.player);
    if (opts.onStateChange) {
      this.engine.setOnStateChange((id) => opts.onStateChange?.(id));
    }

    if (opts.bridge?.onInput) {
      opts.bridge.onInput((ev) => this.engine.handleInput(ev));
    }
  }

  handleInput(ev: CompanionInputEvent): void {
    this.engine.handleInput(ev);
  }

  setState(stateId: string): void {
    this.engine.setState(stateId);
  }

  getCurrentStateId(): string {
    return this.engine.getCurrentStateId();
  }

  dispose(): void {
    this.unsubInput?.();
    this.engine.dispose();
  }
}

export async function loadCharacter(url: string): Promise<CharacterDef> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load character: ${url} (${res.status})`);
  }
  return (await res.json()) as CharacterDef;
}
