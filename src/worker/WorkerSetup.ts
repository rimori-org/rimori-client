import { RimoriClient } from '../plugin/RimoriClient';
import { EventBusHandler } from '../fromRimori/EventBus';

/**
 * Sets up the web worker for the plugin to be able receive and send messages to Rimori.
 * @param pluginId - The id of the plugin to setup the worker for.
 * @param init - The function containing the initialization logic. The init must be completed within 5s. For long running tasks use the init event (e.g. onboarding.triggerInitPlugin) or run the work async.
 * @returns A promise that resolves when the worker is setup.
 */
export async function setupWorker(
  pluginId: string,
  init: (client: RimoriClient) => void | Promise<void>,
): Promise<void> {
  // Mock of the window object for the worker context to be able to use the PluginController.
  const mockWindow = {
    isWorker: true,
    location: {},
    parent: {
      postMessage: () => {},
    },
    addEventListener: () => {},
  };

  // Assign the mock to globalThis.
  Object.assign(globalThis, { window: mockWindow });

  EventBusHandler.getInstance('Worker ' + pluginId + ' EventBus');

  const rimoriClient = await RimoriClient.getInstance(pluginId);
  console.debug('[Worker] RimoriClient initialized.');

  const timoutError = new Error(
    '[Worker ' +
      pluginId +
      '] Worker setup must complete within 5s. Use init event (e.g. onboarding.triggerInitPlugin) or run work async.',
  );

  const initPromise = Promise.resolve(init(rimoriClient));
  const timeout = new Promise((_, reject) => setTimeout(() => reject(timoutError), 5000));

  await Promise.race([initPromise, timeout]);

  console.debug('[Worker] Worker initialized.');

  rimoriClient.event.emit('self.rimori.triggerInitFinished');
}
