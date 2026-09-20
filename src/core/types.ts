/** Data-driven character definition loaded from character.json */

export type StateId = string;

export interface FrameDef {
  /** Asset path relative to character folder, or inline SVG id */
  src: string;
  /** Duration of this frame in ms (optional; falls back to state fps) */
  durationMs?: number;
}

export interface StateDef {
  id: StateId;
  /** Frames played in order while this state is active */
  frames: FrameDef[];
  /** Frames per second when frame.durationMs is omitted */
  fps?: number;
  /** Loop while state is active (default true for idle) */
  loop?: boolean;
  /**
   * After this many ms without re-trigger, fall back to idle.
   * Omit or 0 for permanent states like idle.
   */
  timeoutMs?: number;
}

export interface ReactionDef {
  /** Input event type from the shell / browser */
  trigger: 'keyboard' | 'mousedown' | 'mouseup' | 'mousemove';
  /** State to enter when triggered */
  state: StateId;
  /** Optional priority; higher wins when multiple fire (default 0) */
  priority?: number;
}

export interface CharacterMeta {
  id: string;
  name: string;
  nameZh?: string;
  author?: string;
  version?: string;
  /** Preferred window / canvas size */
  width: number;
  height: number;
}

export interface CharacterDef {
  meta: CharacterMeta;
  /** Default state when nothing is happening */
  defaultState: StateId;
  states: StateDef[];
  reactions: ReactionDef[];
}

export type InputEventType = 'keyboard' | 'mousedown' | 'mouseup' | 'mousemove';

export interface CompanionInputEvent {
  type: InputEventType;
  /** Optional key code / button for future filtering */
  detail?: string | number;
  timestamp: number;
}

export interface CompanionBridge {
  onInput?: (handler: (ev: CompanionInputEvent) => void) => void;
  setIgnoreMouseEvents?: (ignore: boolean, options?: { forward?: boolean }) => void;
}
