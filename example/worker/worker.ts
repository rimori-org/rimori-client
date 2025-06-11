import { setupWorker, RimoriClient } from '@rimori/client/core';

setupWorker(async (client: RimoriClient) => {
  console.log('[Worker] initialized');

  // listening to events for this plugin to create flashcards
  client.event.respond<{ front: string, back: string }>('flashcards.create', ({ data }) => {
    console.log('[Worker] creating flashcards in database', data);
    return { success: true };
  });
});