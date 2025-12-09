# Simple Flashcards - Developer Guide

## Overview

The Simple Flashcards plugin provides spaced repetition learning through an event-based API. Other plugins can create flashcards, request lookups, and trigger training sessions.

**Plugin ID:** `pl123456789`

## Event-based Integration

All communication uses the Rimori event bus with the pattern: `<plugin_id>.<area>.<action>`

### 1. Create Flashcards

#### Basic Creation

```javascript
// Create a simple flashcard
plugin.event.emit('pl123456789.flashcard.create', {
  front: 'Hello',
  back: 'Hola',
  deckId: 'deck-123', // optional, uses default deck if omitted
  frontTags: ['lang:en'],
  backTags: ['lang:es'],
});
```

#### Language-based Creation

```javascript
// Create flashcard with automatic lookup
plugin.event.emit('pl123456789.flashcard.createLangCard', {
  word: 'perro',
  language: 'es', // optional, uses user's mother tongue if omitted
  deckId: 'spanish-nouns', // optional
});
```

### 2. Lookup Requests

#### Basic Translation

```javascript
// Request word translation
const translation = await plugin.event.request('pl123456789.lookup.request', {
  word: 'laufen',
  language: 'de', // optional
});

// Returns:
// {
//   input: "laufen",
//   language: "de",
//   type: "verb",
//   swedish_translation: "att springa",
//   translation: "to run"
// }
```

#### Advanced Lookup

```javascript
// Get detailed word information
const details = await plugin.event.request('pl123456789.lookup.request', {
  word: 'laufen',
  language: 'de',
});

// Returns extended object with grammar, examples, tenses, etc.
```

### 3. Deck Management

#### Get Available Decks

```javascript
const decks = await plugin.event.request('pl123456789.deck.requestOpenToday');

// Returns:
// [
//   {
//     id: "deck-123",
//     name: "Spanish Vocabulary",
//     total_new: 5,
//     total_learning: 12,
//     total_review: 8
//   }
// ]
```

#### Create New Deck

```javascript
const newDeck = await plugin.event.request('pl123456789.deck.create', {
  name: 'German Verbs',
});

// Returns: { id: "deck-456", name: "German Verbs", last_used: "2025-01-06T..." }
```

### 4. Trigger Training

#### Open Flashcard Training

```javascript
// Open training in main panel
plugin.event.emit('global.mainPanel.triggerAction', {
  pluginId: 'pl123456789',
  actionKey: 'flashcards',
  deck: 'latest', // or "random", "oldest", "mix", deck ID
  total_amount: 20, // or "default"
});
```

## Worker Function Example

### Background Deck Sync

```javascript
// worker/listeners/deck-sync.ts
import { WorkerEventListener } from '@rimori/client';

export const deckSyncListener: WorkerEventListener = {
  eventName: 'pl123456789.deck.syncProgress',

  async handler(data: { userId: string; deckId: string }) {
    const { userId, deckId } = data;

    // Calculate learning statistics
    const stats = await calculateDeckProgress(deckId, userId);

    // Update user's learning streak
    await updateLearningStreak(userId, stats);

    // Send progress update to main thread
    self.postMessage({
      type: 'progress-updated',
      deckId,
      stats: {
        cardsReviewed: stats.reviewed,
        accuracy: stats.accuracy,
        streak: stats.streak
      }
    });
  }
};

async function calculateDeckProgress(deckId: string, userId: string) {
  // Database queries to calculate progress
  const cards = await db.from('flashcards')
    .select('*')
    .eq('deck_id', deckId)
    .eq('user_id', userId);

  const reviewed = cards.filter(c => c.last_review_date >= getTodayStart());
  const accuracy = reviewed.reduce((acc, c) => acc + c.ease_factor, 0) / reviewed.length;

  return {
    reviewed: reviewed.length,
    accuracy: Math.round(accuracy * 100),
    streak: await calculateStreak(userId)
  };
}
```

## Database Schema Pattern

```typescript
// Example table structure
interface Flashcard {
  id: string;
  user_id: string;
  deck_id: string;
  front: string;
  back: string;
  front_tags: string[];
  back_tags: string[];
  ease_factor: number;
  interval: number;
  due_date: string;
  last_review_date?: string;
}

interface Deck {
  id: string;
  user_id: string;
  name: string;
  last_used: string;
  created_at: string;
}
```

## Integration Examples

### Dictionary Plugin → Flashcards

```javascript
// When user looks up a word in dictionary
function onWordLookup(word: string, translation: string) {
  // Automatically create flashcard
  plugin.event.emit("pl123456789.flashcard.create", {
    front: word,
    back: translation,
    frontTags: ["lang:sv"],
    backTags: ["lang:en", "dictionary-lookup"]
  });
}
```

### Study Planner → Flashcards

```javascript
// Trigger daily flashcard session
function scheduleDailyReview() {
  plugin.event.emit('global.mainPanel.triggerAction', {
    pluginId: 'pl123456789',
    actionKey: 'flashcards',
    deck: 'mix',
    total_amount: 30,
  });
}
```

## Error Handling

```javascript
try {
  await plugin.event.request('pl123456789.flashcard.create', cardData);
} catch (error) {
  console.error('Failed to create flashcard:', error);
  // Handle error appropriately
}
```

## Best Practices

- Always provide meaningful error messages
- Use consistent tagging for language features
- Batch operations when creating multiple cards
- Respect user's daily review limits
- Include proper TypeScript types for payloads
