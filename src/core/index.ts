export type {
  CharacterDef,
  CharacterMeta,
  CompanionBridge,
  CompanionInputEvent,
  FrameDef,
  InputEventType,
  ReactionDef,
  StateDef,
  StateId,
} from './types';
export { AnimationPlayer } from './animation-player';
export { ReactionEngine } from './reaction-engine';
export { Companion, loadCharacter } from './companion';
export type { CompanionOptions } from './companion';

// Idle-gear game systems
export * from './game/index';
