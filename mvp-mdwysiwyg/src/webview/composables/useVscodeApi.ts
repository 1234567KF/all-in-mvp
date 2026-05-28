import { ref, type Ref } from 'vue';
import type { VsMessage } from '../types/index';

interface VscodeApi {
  postMessage(message: VsMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VscodeApi;

let api: VscodeApi | null = null;

function getApi(): VscodeApi {
  if (!api) {
    try {
      api = acquireVsCodeApi();
    } catch {
      // Running outside VS Code (dev mode)
      api = {
        postMessage: (msg) => console.log('[dev] postMessage:', msg),
        getState: () => null,
        setState: () => {},
      };
    }
  }
  return api;
}

export function useVscodeApi() {
  function postMessage(type: string, payload: unknown = {}) {
    getApi().postMessage({ type, payload });
  }

  function onMessage(handler: (msg: VsMessage) => void): () => void {
    const listener = (event: MessageEvent) => {
      handler(event.data);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }

  return { postMessage, onMessage };
}
