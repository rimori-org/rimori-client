import { RimoriClient } from "../plugin/RimoriClient";
import { EventBusHandler } from "../fromRimori/EventBus";
import { PluginController } from "../plugin/PluginController";

/**
 * Sets up the web worker for the plugin to be able receive and send messages to Rimori.
 * @param pluginId - The id of the plugin to setup the worker for.
 * @param init - The function containing the initialization logic.
 */
export async function setupWorker(pluginId: string, init: (client: RimoriClient) => void | Promise<void>) {
  
  // Mock of the window object for the worker context to be able to use the PluginController.
  const mockWindow = {
    isWorker: true,
    location: {},
    parent: {
      postMessage: () => { }
    },
    addEventListener: () => { }
  };

  // Assign the mock to globalThis.
  Object.assign(globalThis, { window: mockWindow });

  EventBusHandler.getInstance("Worker EventBus");

  const rimoriClient = await PluginController.getInstance(pluginId);
  console.debug('[Worker] RimoriClient initialized.');

  await init(rimoriClient);
  console.debug('[Worker] Worker initialized.');

  self.postMessage({ type: "rimori:acknowledged", pluginId: pluginId });
}