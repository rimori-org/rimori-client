import { EventBus, EventBusHandler, EventBusMessage } from "../fromRimori/EventBus";
import { PluginController } from "../plugin/PluginController";
import { RimoriClient } from "../plugin/RimoriClient";

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
      postMessage: (message: any) => {
        // Workers should only send EventBus messages, not direct messages like rimori:hello
        // If it's not an EventBus message, ignore it (workers shouldn't do MessageChannel handshake)
        if (message.event) {
          message.event.sender = "worker." + message.event.sender;
          checkDebugMode(message.event);
          logIfDebug('sending event to Rimori', message.event);
          self.postMessage(message)
        } else {
          // Ignore non-EventBus messages (like rimori:hello) - workers don't do MessageChannel handshake
          logIfDebug('ignoring non-EventBus message in worker context', message);
        }
      }
    },
    addEventListener: (_: string, listener: any) => {
      listeners.push(listener);
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
        // No need for APP_CONFIG - PluginController will use EventBus to get Supabase access
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