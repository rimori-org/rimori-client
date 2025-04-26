import { PluginController } from "../plugin/PluginController";
import { RimoriClient } from "../plugin/RimoriClient";
import { EventBusMessage } from "../plugin/PluginController";

let controller: RimoriClient | null = null;
const listeners: ((event: { data: { event: EventBusMessage, secret: string } }) => void)[] = [];

/**
 * Sets up the web worker for the plugin to be able receive and send messages to Rimori.
 * @param init - The function containing the subscription logic.
 */
export function setupWorker(init: (controller: RimoriClient) => void | Promise<void>) {
  // Mock of the window object for the worker context to be able to use the PluginController.
  const mockWindow = {
    location: { search: '?secret=123' },
    parent: { postMessage: (message: { event: EventBusMessage } ) => {
      // console.log('[Worker] postMessage', message);
      message.event.sender = "worker." + message.event.sender;
      self.postMessage(message)
    } },
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
  self.onmessage = async (response: MessageEvent) => {
    // console.log('[Worker] message received', response.data);
    const event = response.data as EventBusMessage;

    if (event.topic === 'global.worker.requestInit') {
      if (!controller) {
        mockWindow.APP_CONFIG.SUPABASE_URL = event.data.supabaseUrl;
        mockWindow.APP_CONFIG.SUPABASE_ANON_KEY = event.data.supabaseAnonKey;
        controller = await PluginController.getInstance();
        // console.log('[Worker] controller initialized', controller);
        await init(controller);
      }
      const initEvent: EventBusMessage = {
        timestamp: new Date().toISOString(),
        eventId: event.eventId,
        sender: "worker." + event.sender,
        topic: 'global.worker.requestInit',
        data: { success: true }
      };
      return self.postMessage({ secret: "123", event: initEvent });
    }
    // console.log('[Worker] listeners', listeners);
    listeners.forEach(listener => listener({ data: { event: response.data, secret: "123" } }));
  };
}