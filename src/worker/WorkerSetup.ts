import { PluginController } from "../plugin/PluginController";
import { RimoriClient } from "../plugin/RimoriClient";

let controller: RimoriClient | null = null;
const listeners: ((event: MessageEvent) => void)[] = [];

/**
 * Sets up the web worker for the plugin to be able receive and send messages to Rimori.
 * @param init - The function containing the subscription logic.
 */
export function setupWorker(init: (controller: RimoriClient) => void | Promise<void>) {
  // Mock of the window object for the worker context to be able to use the PluginController.
  const mockWindow = {
    location: { search: '?secret=123' },
    parent: { postMessage: (message: unknown) => self.postMessage(message) },
    addEventListener: (_: string, listener: any) => {
      listeners.push(listener);
    },
    APP_CONFIG: {
      SUPABASE_URL: 'NOT_SET',
      SUPABASE_ANON_KEY: 'NOT_SET',
    },
  };

  // Assign the mock to globalThis.
  Object.assign(globalThis, { window: mockWindow });

  // Handle init message from Rimori.
  self.onmessage = async (event: MessageEvent) => {
    // console.log('[Worker] message received', event.data);

    if (event.data.type === 'init') {
      if (!controller) {
        mockWindow.APP_CONFIG.SUPABASE_URL = event.data.supabaseUrl;
        mockWindow.APP_CONFIG.SUPABASE_ANON_KEY = event.data.supabaseAnonKey;
        controller = await PluginController.getInstance();
        await init(controller);
      }
      return self.postMessage({ type: 'init', success: true });
    }
    listeners.forEach(listener => listener(event));
  };
}