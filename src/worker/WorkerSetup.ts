import { RimoriClient } from "../plugin/RimoriClient";
import { PluginController } from "../plugin/PluginController";
import { EventBus, EventBusHandler, EventBusMessage } from "../plugin/fromRimori/EventBus";

let controller: RimoriClient | null = null;
const listeners: ((event: { data: { event: EventBusMessage, secret: string } }) => void)[] = [];
let debugEnabled = false;

/**
 * Sets up the web worker for the plugin to be able receive and send messages to Rimori.
 * @param init - The function containing the subscription logic.
 */
export function setupWorker(init: (controller: RimoriClient) => void | Promise<void>) {
  // Mock of the window object for the worker context to be able to use the PluginController.
  const mockWindow = {
    isWorker: true,
    location: { search: '?secret=123' },
    parent: {
      postMessage: (message: { event: EventBusMessage }) => {
        message.event.sender = "worker." + message.event.sender;
        checkDebugMode(message.event);
        logIfDebug('sending event to Rimori', message.event);
        self.postMessage(message)
      }
    },
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

  EventBusHandler.getInstance("Worker EventBus");

  // Handle init message from Rimori.
  self.onmessage = async (response: MessageEvent) => {
    checkDebugMode(response.data);
    logIfDebug('Message received', response.data);

    const event = response.data as EventBusMessage;

    if (event.topic === 'global.worker.requestInit') {
      if (!controller) {
        mockWindow.APP_CONFIG.SUPABASE_URL = event.data.supabaseUrl;
        mockWindow.APP_CONFIG.SUPABASE_ANON_KEY = event.data.supabaseAnonKey;
        controller = await PluginController.getInstance(event.data.pluginId);
        logIfDebug('Worker initialized.');
        await init(controller);
        logIfDebug('Plugin listeners initialized.');
      }
      const initEvent: EventBusMessage = {
        timestamp: new Date().toISOString(),
        eventId: event.eventId,
        sender: "worker." + event.sender,
        topic: 'global.worker.requestInit',
        data: { success: true },
        debug: debugEnabled
      };
      return self.postMessage({ secret: "123", event: initEvent });
    }
    listeners.forEach(listener => listener({ data: { event: response.data, secret: "123" } }));
  };
}

function checkDebugMode(event: EventBusMessage) {
  if (event.topic === 'global.system.requestDebug' || event.debug) {
    debugEnabled = true;
    EventBus.emit("worker", "global.system.requestDebug");
  }
}

function logIfDebug(...args: any[]) {
  if (debugEnabled) {
    console.debug('[Worker] ' + args[0], ...args.slice(1));
  }
}