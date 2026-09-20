import type { CompanionBridge, CompanionInputEvent } from '@core/types';

declare global {
  interface Window {
    guaji?: {
      isElectron: boolean;
      onInput: (cb: (ev: CompanionInputEvent) => void) => () => void;
      setIgnoreMouseEvents: (ignore: boolean, options?: { forward?: boolean }) => void;
      reportInput?: (payload: CompanionInputEvent) => void;
    };
  }
}

/** Electron preload bridge, or a browser fallback that listens to local events. */
export function createBridge(): CompanionBridge & { isElectron: boolean } {
  if (window.guaji?.isElectron) {
    return {
      isElectron: true,
      onInput: (handler) => {
        window.guaji!.onInput(handler);
      },
      setIgnoreMouseEvents: (ignore, options) => {
        window.guaji!.setIgnoreMouseEvents(ignore, options);
      },
    };
  }

  // Browser / Vite preview: page-local keyboard & mouse
  const listeners: Array<(ev: CompanionInputEvent) => void> = [];
  const emit = (type: CompanionInputEvent['type'], detail?: string | number) => {
    const ev: CompanionInputEvent = { type, detail, timestamp: Date.now() };
    for (const h of listeners) h(ev);
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    emit('keyboard', e.code);
  });
  window.addEventListener('mousedown', (e) => emit('mousedown', e.button));
  window.addEventListener('mouseup', (e) => emit('mouseup', e.button));

  return {
    isElectron: false,
    onInput: (handler) => {
      listeners.push(handler);
    },
    setIgnoreMouseEvents: () => {
      /* no-op in browser */
    },
  };
}
