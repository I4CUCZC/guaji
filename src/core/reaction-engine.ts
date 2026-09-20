import type {
  CharacterDef,
  CompanionInputEvent,
  ReactionDef,
  StateDef,
  StateId,
} from './types';
import { AnimationPlayer } from './animation-player';

export type StateChangeCallback = (stateId: StateId, state: StateDef) => void;

/**
 * Maps input events → character states, with idle timeout fallback.
 * Pure logic — no DOM / Electron imports.
 */
export class ReactionEngine {
  private character: CharacterDef;
  private statesById: Map<StateId, StateDef>;
  private player: AnimationPlayer;
  private currentStateId: StateId;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private onStateChange: StateChangeCallback | null = null;

  constructor(character: CharacterDef, player: AnimationPlayer) {
    this.character = character;
    this.player = player;
    this.statesById = new Map(character.states.map((s) => [s.id, s]));
    this.currentStateId = character.defaultState;
    this.enterState(character.defaultState);
  }

  setOnStateChange(cb: StateChangeCallback): void {
    this.onStateChange = cb;
  }

  getCurrentStateId(): StateId {
    return this.currentStateId;
  }

  handleInput(ev: CompanionInputEvent): void {
    const matches = this.character.reactions
      .filter((r) => r.trigger === ev.type)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    const best: ReactionDef | undefined = matches[0];
    if (!best) return;
    this.enterState(best.state);
  }

  /** Force a state (useful for demos / tests) */
  setState(stateId: StateId): void {
    this.enterState(stateId);
  }

  dispose(): void {
    this.clearIdleTimer();
    this.player.stop();
  }

  private enterState(stateId: StateId): void {
    const state = this.statesById.get(stateId);
    if (!state) {
      console.warn(`[ReactionEngine] Unknown state: ${stateId}`);
      return;
    }

    this.currentStateId = stateId;
    this.player.play(state);
    this.onStateChange?.(stateId, state);
    this.scheduleIdle(state);
  }

  private scheduleIdle(state: StateDef): void {
    this.clearIdleTimer();
    const timeout = state.timeoutMs ?? 0;
    if (timeout <= 0) return;
    if (state.id === this.character.defaultState) return;

    this.idleTimer = setTimeout(() => {
      this.enterState(this.character.defaultState);
    }, timeout);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer != null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
