# Rimori Client Package

The **@rimori/client** package is a comprehensive React library that enables plugins to seamlessly integrate with the Rimori learning platform. It provides database access, AI/LLM integration, inter-plugin communication, community features, and pre-built UI components.

## Table of Contents

- [Installation](#installation)
- [Quick Start Plugin Development](#quick-start-plugin-development)
- [Releasing Your Plugin to Rimori](#releasing-your-plugin-to-rimori)
- [Quick Start](#quick-start)
- [Core API - usePlugin Hook](#core-api---useplugin-hook)
- [Database Integration](#database-integration)
- [LLM Integration](#llm-integration)
- [Event System](#event-system)
- [Community Features](#community-features)
- [Components](#components)
- [Hooks](#hooks)
- [Utilities](#utilities)
- [TypeScript Support](#typescript-support)
- [Examples](#examples)

## Installation

```bash
npm install @rimori/client
# or
yarn add @rimori/client
```

## Quick Start Plugin Development

The Rimori Client package includes powerful CLI tools to eliminate the tedious setup process and get you building your plugin fast. The initialization script handles authentication, plugin registration, environment setup, and all necessary boilerplate configuration.

### Prerequisites

Before initializing your plugin, ensure you have:

1. **Node.js and yarn/npm installed**
2. **A Rimori account** - You'll need to login during initialization to receive your access token

### Initializing a New Plugin

Open Lovable and vibe code the look of your plugin.

Then connect it to your Github account.

Clone the git repository:

```bash
git clone ...
cd my-awesome-plugin

# Initialize with Rimori Client (this handles everything!)
npx @rimori/client rimori-init
```

### What the Init Script Does

The `rimori-init` command automates the entire plugin setup process:

1. **🔐 Authentication**: Prompts for your Rimori credentials and authenticates with the platform
2. **🚀 Plugin Registration**: Automatically registers your plugin and generates a unique plugin ID
3. **🔑 Access Token**: Provides you with an access token for future plugin releases
4. **📦 Package Configuration**: Updates `package.json` with plugin-specific settings
5. **⚙️ Environment Setup**: Creates `.env` files with your credentials
6. **📁 File Structure**: Copies all necessary boilerplate files and examples
7. **🎨 Configuration**: Sets up Vite, Tailwind, and router configurations
8. **📖 Documentation**: Provides example documentation and getting started guides

### Upgrade Mode

If you need to upgrade an existing plugin's configuration without changing the plugin ID:

```bash
yarn rimori-init --upgrade
```

### Development Setup

After initialization, start developing immediately:

```bash
# Start development server
yarn dev

# Your plugin will be available at:
# http://localhost:3000 (or your chosen port)
```

Rimori client comes pre-configured with:

- ✅ **Hot reload** for instant development feedback
- ✅ **TypeScript support** with full type safety
- ✅ **TailwindCSS** for modern styling
- ✅ **React Router** for navigation
- ✅ **Example components** and documentation

## Releasing Your Plugin to Rimori

Publishing your plugin to the Rimori platform is streamlined through the built-in `rimori-release` CLI tool. The release process handles database updates, file uploads, and plugin activation automatically.

### Prerequisites

1. **Plugin must be initialized** - Use `rimori-init` first to set up your plugin
2. **Build your plugin** - Ensure your plugin is built and the output is in the `dist/` directory
3. **Environment configured** - Your `.env` file should contain `RIMORI_TOKEN` (set during initialization)

### Quick Release (Recommended)

During plugin initialization, convenient release scripts are automatically added to your `package.json`. These scripts handle building and releasing in one command:

```bash
# Quick release commands (build + release)
yarn release:alpha     # Build and release to alpha channel
yarn release:beta      # Build and release to beta channel
yarn release:stable    # Build and release to stable channel
```

### Manual Release Process

If you prefer more control or need to understand the underlying process, you can use the `rimori-release` command directly:

```bash
# Build your plugin first
yarn build

# Then release to different channels
yarn rimori-release alpha    # For alpha testing
yarn rimori-release beta     # For beta releases
yarn rimori-release stable   # For production releases
```

The plugin version is automatically read from your `package.json`, and the plugin ID is retrieved from the `r_id` field (set during initialization).

### What the Release Script Does

The `rimori-release` command performs a complete release workflow:

1. **📋 Configuration Upload**: Sends plugin metadata and configuration to the platform
2. **🗄️ Database Updates**: Updates plugin information and release records
3. **📁 File Upload**: Uploads all files from your `dist/` directory to the platform
4. **🚀 Plugin Activation**: Activates the new version on the specified release channel

### Release Channels

- **`alpha`**: Early development releases for internal testing
- **`beta`**: Pre-release versions for beta testers
- **`stable`**: Production-ready releases for all users

### Automatic Configuration

During plugin initialization, the following are automatically configured:

- `RIMORI_TOKEN`: Your authentication token (stored in `.env`)
- `r_id`: Your unique plugin ID (stored in `package.json`)
- **Release scripts**: `yarn release:alpha`, `yarn release:beta`, `yarn release:stable`
- **Build configuration**: TypeScript checking, Vite setup, and worker builds

### Troubleshooting

If you encounter release issues:

1. **Missing token**: Ensure `RIMORI_TOKEN` is in your `.env` file
2. **No plugin ID**: Verify `r_id` exists in your `package.json`
3. **Build errors**: Run `yarn build` successfully before releasing
4. **Authentication**: Your token may have expired - re-run `rimori-init` if needed

#### Worker Process Errors

If you encounter errors like:

```
ReferenceError: process is not defined
```

**Root Cause**: Your plugin is importing a library that tries to access `process` or `process.env` in the worker context. Web workers don't have access to Node.js globals like `process`.

**Debugging Steps**:

1. **Check your imports**: Look through the files used in the worker which might import libraries that might access `process.env`:
   - React libraries (React Router, React Query, etc.)
   - UI component libraries (Material-UI, Ant Design, etc.)
   - Utility libraries that check for environment variables

2. **Verify Rimori Client imports**: Ensure you're importing from `@rimori/client/core` and not from `@rimori/client`:

   ```typescript
   // ✅ Correct - import from rimori client
   import { RimoriClient } from '@rimori/client/core';

   // ❌ Incorrect - direct imports that might access process.env directly or through their dependencies
   import { Avatar } from '@rimori/client';
   import { useQuery } from '@tanstack/react-query';
   ```

3. **Check your dependencies**: Look at your `package.json` for libraries that might be bundled into the worker:
   - UI frameworks (React, Vue, etc.)
   - State management libraries
   - Routing libraries
   - Any library that checks `process.env.NODE_ENV`

**Solution**: Use only `@rimori/client/core` exports in your worker code. The Rimori client provides all necessary functionality without requiring Node.js globals.

**Note**: The worker bundling order is determined by the build system and cannot be controlled. Libraries that access `process.env` will always cause this error in the worker context.

````

## Core API - usePlugin Hook

The `useRimori()` hook is the main interface for accessing Rimori platform features:

```typescript
import { useRimori } from "@rimori/client";

const MyComponent = () => {
  const client = useRimori();

  // Access all client features
  const { db, llm, event, community, plugin } = client;

  return <div>My Plugin Content</div>;
};
````

### Plugin Interface

```typescript
const { plugin } = useRimori();

// Plugin information and settings
plugin.pluginId: string                              // Current plugin ID
plugin.getSettings<T>(defaultSettings: T): Promise<T>  // Get plugin settings
plugin.setSettings(settings: any): Promise<void>    // Update plugin settings
plugin.getInstalled(): Promise<Plugin[]>            // Get all installed plugins
plugin.getUserInfo(): Promise<UserInfo>             // Get current user information
```

**Example: Managing Flashcard Plugin Settings**

```typescript
interface FlashcardSettings {
  dailyGoal: number;
  reviewInterval: 'easy' | 'medium' | 'hard';
  showAnswerDelay: number;
  enableAudioPronunciation: boolean;
  difficultyAlgorithm: 'spaced-repetition' | 'random' | 'progressive';
}

const FlashcardSettingsComponent = () => {
  const { plugin } = useRimori();
  const [settings, setSettings] = useState<FlashcardSettings>();

  useEffect(() => {
    const loadSettings = async () => {
      const defaultSettings: FlashcardSettings = {
        dailyGoal: 20,
        reviewInterval: 'medium',
        showAnswerDelay: 3,
        enableAudioPronunciation: true,
        difficultyAlgorithm: 'spaced-repetition'
      };

      const currentSettings = await plugin.getSettings(defaultSettings);
      setSettings(currentSettings);
    };

    loadSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<FlashcardSettings>) => {
    const updated = { ...settings, ...newSettings };
    await plugin.setSettings(updated);
    setSettings(updated);
  };

  return (
    <div className="flashcard-settings">
      <label>
        Daily Goal: {settings?.dailyGoal} cards
        <input
          type="range"
          min="5"
          max="100"
          value={settings?.dailyGoal}
          onChange={(e) => updateSettings({ dailyGoal: parseInt(e.target.value) })}
        />
      </label>

      <label>
        Review Interval:
        <select
          value={settings?.reviewInterval}
          onChange={(e) => updateSettings({ reviewInterval: e.target.value as any })}
        >
          <option value="easy">Easy (longer intervals)</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard (shorter intervals)</option>
        </select>
      </label>

      <label>
        <input
          type="checkbox"
          checked={settings?.enableAudioPronunciation}
          onChange={(e) => updateSettings({ enableAudioPronunciation: e.target.checked })}
        />
        Enable Audio Pronunciation
      </label>
    </div>
  );
};
```

## Database Integration

Access your plugin's dedicated database tables with full TypeScript support:

```typescript
const { db } = useRimori();

// Database interface
db.from(tableName)                    // Query builder for tables/views - supports ALL Supabase operations
db.storage                           // File storage access
db.tablePrefix: string               // Your plugin's table prefix
db.getTableName(table: string): string  // Get full table name with prefix
```

The `db.from()` method provides access to the complete Supabase PostgREST API, supporting all database operations including:

- **CRUD Operations**: `insert()`, `select()`, `update()`, `delete()`, `upsert()`
- **Filtering**: `eq()`, `neq()`, `gt()`, `gte()`, `lt()`, `lte()`, `like()`, `ilike()`, `is()`, `in()`, `contains()`, `containedBy()`, `rangeLt()`, `rangeGt()`, `rangeGte()`, `rangeLte()`, `rangeAdjacent()`, `overlaps()`, `textSearch()`, `match()`, `not()`, `or()`, `filter()`
- **Modifiers**: `order()`, `limit()`, `range()`, `single()`, `maybe_single()`, `csv()`, `geojson()`, `explain()`
- **Aggregations**: `count()`, `sum()`, `avg()`, `min()`, `max()`
- **Advanced Features**: Row Level Security (RLS), real-time subscriptions, stored procedures, and custom functions

All operations automatically use your plugin's table prefix for security and isolation.

**Column deprecation and removal (short policy)**

- To remove a column, use a two-step process:
  1. Mark the column with `deprecated: true` in your `rimori/db.config.ts` and release. The backend renames the column to `<name>_old`.
  2. In a subsequent release, remove the column from the config. The backend drops `<name>_old`.

**Example: CRUD Operations**

```typescript
interface StudySession {
  id?: string;
  user_id: string;
  topic: string;
  duration: number;
  completed_at: string;
}

const StudySessionManager = () => {
  const { db } = useRimori();

  // Create a new study session
  const createSession = async (session: Omit<StudySession, 'id'>) => {
    const { data, error } = await db
      .from('study_sessions')  // Automatically prefixed
      .insert(session)
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  // Get user's study sessions
  const getUserSessions = async (userId: string) => {
    const { data, error } = await db
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false });

    if (error) throw error;
    return data;
  };

  // Update session
  const updateSession = async (id: string, updates: Partial<StudySession>) => {
    const { data, error } = await db
      .from('study_sessions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  return (
    <div>
      {/* Your component UI */}
    </div>
  );
};
```

**File Storage Example**

```typescript
const FileManager = () => {
  const { db } = useRimori();

  const uploadFile = async (file: File) => {
    const fileName = `uploads/${Date.now()}-${file.name}`;

    const { data, error } = await db.storage
      .from('plugin-files')
      .upload(fileName, file);

    if (error) throw error;
    return data;
  };

  const downloadFile = async (filePath: string) => {
    const { data, error } = await db.storage
      .from('plugin-files')
      .download(filePath);

    if (error) throw error;
    return data;
  };

  return <div>File Manager UI</div>;
};
```

## LLM Integration

Powerful AI/Language Model capabilities built-in:

```typescript
const { llm } = useRimori();

// Text generation
llm.getText(messages: Message[], tools?: Tool[]): Promise<string>

// Streaming text generation
llm.getSteamedText(messages: Message[], onMessage: OnLLMResponse, tools?: Tool[]): void

// Structured object generation
llm.getObject(request: ObjectRequest): Promise<any>

// Text-to-speech
llm.getVoice(text: string, voice?: string, speed?: number, language?: string): Promise<Blob>

// Speech-to-text
llm.getTextFromVoice(file: Blob): Promise<string>
```

**Example: AI Chat Assistant**

```typescript
import { useChat } from "@rimori/client";

const ChatAssistant = () => {
  const { messages, append, isLoading } = useChat();
  const [input, setInput] = useState('');

  const sendMessage = () => {
    if (!input.trim()) return;

    append([{
      role: 'user',
      content: input
    }]);

    setInput('');
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.role}`}>
            {message.content}
          </div>
        ))}
        {isLoading && <div className="message assistant">Thinking...</div>}
      </div>

      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask anything..."
        />
        <button onClick={sendMessage} disabled={isLoading}>
          Send
        </button>
      </div>
    </div>
  );
};
```

**Example: Structured Data Generation**

```typescript
const QuizGenerator = () => {
  const { llm } = useRimori();

  const generateQuiz = async (topic: string) => {
    const quiz = await llm.getObject({
      schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                correctAnswer: { type: "number" },
                explanation: { type: "string" }
              }
            }
          }
        }
      },
      prompt: `Create a quiz about ${topic} with 5 multiple choice questions.`
    });

    return quiz;
  };

  return <div>Quiz Generator UI</div>;
};
```

**Example: Voice Integration**

```typescript
const VoiceAssistant = () => {
  const { llm } = useRimori();

  const speakText = async (text: string) => {
    const audioBlob = await llm.getVoice(text, "alloy", 1, "en");
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();
  };

  const transcribeAudio = async (audioFile: File) => {
    const transcript = await llm.getTextFromVoice(audioFile);
    return transcript;
  };

  return <div>Voice Assistant UI</div>;
};
```

## Event System

Robust inter-plugin communication and platform integration:

```typescript
const { event } = useRimori();

// Event methods
event.emit(topic: string, data?: any, eventId?: number): void
event.request<T>(topic: string, data?: any): Promise<EventBusMessage<T>>
event.on<T>(topic: string | string[], callback: EventHandler<T>): string[]
event.once<T>(topic: string, callback: EventHandler<T>): void
event.respond<T>(topic: string, data: EventPayload | Function): void

// Accomplishments
event.emitAccomplishment(payload: AccomplishmentPayload): void
event.onAccomplishment(topic: string, callback: Function): void

// Sidebar actions
event.emitSidebarAction(pluginId: string, actionKey: string, text?: string): void
```

**Example: Plugin Communication**

```typescript
const PluginCommunicator = () => {
  const { event } = useRimori();

  useEffect(() => {
    // Listen for messages from other plugins
    const unsubscribe = event.on('flashcards.newCard', (message) => {
      console.log('New flashcard created:', message.data);
    });

    // Listen for global events
    event.on('global.userProgress', (message) => {
      console.log('User progress updated:', message.data);
    });

    return () => {
      // Cleanup subscriptions
      unsubscribe.forEach(id => event.off(id));
    };
  }, []);

  const shareData = () => {
    // Emit data to other plugins
    event.emit('studyplan.dataUpdate', {
      type: 'session_completed',
      sessionId: '123',
      score: 85
    });
  };

  const requestData = async () => {
    // Request data from another plugin
    const response = await event.request('flashcards.getStats', {
      timeframe: 'week'
    });

    console.log('Flashcard stats:', response.data);
  };

  return (
    <div>
      <button onClick={shareData}>Share Progress</button>
      <button onClick={requestData}>Get Flashcard Stats</button>
    </div>
  );
};
```

**Example: Accomplishment System**

```typescript
const AccomplishmentTracker = () => {
  const { event } = useRimori();

  const trackAccomplishment = () => {
    event.emitAccomplishment({
      type: 'study_milestone',
      title: 'Study Streak',
      description: 'Completed 7 days of studying',
      points: 100,
      metadata: {
        streakDays: 7,
        subject: 'Spanish'
      }
    });
  };

  useEffect(() => {
    // Listen for accomplishments from this plugin
    event.onAccomplishment('study_milestone', (accomplishment) => {
      console.log('New accomplishment:', accomplishment);
      // Show notification, update UI, etc.
    });
  }, []);

  return <div>Accomplishment Tracker UI</div>;
};
```

**Example: Sidebar Integration**

```typescript
const SidebarIntegration = () => {
  const { event } = useRimori();

  const openTranslator = (text: string) => {
    // Trigger translator plugin in sidebar
    event.emitSidebarAction('translator', 'translate', text);
  };

  const openFlashcards = () => {
    // Open flashcards plugin
    event.emitSidebarAction('flashcards', 'review');
  };

  return (
    <div>
      <button onClick={() => openTranslator('Hello world')}>
        Translate "Hello world"
      </button>
      <button onClick={openFlashcards}>
        Review Flashcards
      </button>
    </div>
  );
};
```

## Community Features

Share and discover content created by other users:

```typescript
const { community } = useRimori();

// Shared content methods
community.sharedContent.get<T>(contentType: string, id: string): Promise<BasicAssignment<T>>
community.sharedContent.getList<T>(contentType: string, filter?: SharedContentFilter, limit?: number): Promise<BasicAssignment<T>[]>
community.sharedContent.getNew<T>(contentType: string, instructions: SharedContentObjectRequest, filter?: SharedContentFilter, privateTopic?: boolean): Promise<BasicAssignment<T>>
community.sharedContent.create<T>(content: SharedContent<T>): Promise<BasicAssignment<T>>
community.sharedContent.update<T>(id: string, content: Partial<SharedContent<T>>): Promise<BasicAssignment<T>>
community.sharedContent.remove(id: string): Promise<BasicAssignment<any>>
community.sharedContent.complete(contentType: string, assignmentId: string): Promise<void>
```

**Example: Exercise Sharing Platform**

```typescript
interface Exercise {
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  questions: Array<{
    question: string;
    answer: string;
    hints?: string[];
  }>;
}

const ExerciseManager = () => {
  const { community } = useRimori();
  const [exercises, setExercises] = useState<BasicAssignment<Exercise>[]>([]);

  // Load community exercises
  const loadExercises = async () => {
    const exerciseList = await community.sharedContent.getList<Exercise>(
      'grammar_exercises',
      { column: 'difficulty', value: 'beginner' },
      10
    );
    setExercises(exerciseList);
  };

  // Create new exercise
  const createExercise = async (exercise: Exercise) => {
    const newExercise = await community.sharedContent.create({
      content_type: 'grammar_exercises',
      content: exercise,
      metadata: {
        difficulty: exercise.difficulty,
        questionCount: exercise.questions.length
      }
    });

    return newExercise;
  };

  // Generate AI exercise
  const generateExercise = async (topic: string) => {
    const aiExercise = await community.sharedContent.getNew<Exercise>(
      'grammar_exercises',
      {
        prompt: `Create a grammar exercise about ${topic}`,
        schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  answer: { type: "string" },
                  hints: { type: "array", items: { type: "string" } }
                }
              }
            }
          }
        }
      },
      { column: 'difficulty', value: 'beginner' }
    );

    return aiExercise;
  };

  // Complete exercise
  const completeExercise = async (exerciseId: string) => {
    await community.sharedContent.complete('grammar_exercises', exerciseId);
    // Exercise is now marked as completed for the user
  };

  return (
    <div>
      <button onClick={loadExercises}>Load Exercises</button>
      <button onClick={() => generateExercise('present tense')}>
        Generate Present Tense Exercise
      </button>
      {/* Exercise list UI */}
    </div>
  );
};
```

## Components

Pre-built React components for common functionality:

### MarkdownEditor

Rich text editor with markdown support:

```typescript
import { MarkdownEditor } from "@rimori/client";

const EditorExample = () => {
  const [content, setContent] = useState('');

  return (
    <MarkdownEditor
      value={content}
      onChange={setContent}
      placeholder="Start writing..."
    />
  );
};
```

### CRUDModal

Modal component for create/update operations:

```typescript
import { CRUDModal } from "@rimori/client";

const DataManager = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);

  return (
    <CRUDModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      title={editItem ? "Edit Item" : "Create Item"}
      onSave={(data) => {
        // Handle save logic
        console.log('Saving:', data);
        setIsOpen(false);
      }}
      initialData={editItem}
    >
      {/* Your form content */}
      <input placeholder="Item name" />
      <textarea placeholder="Description" />
    </CRUDModal>
  );
};
```

### Spinner

Loading indicator component:

```typescript
import { Spinner } from "@rimori/client";

const LoadingExample = () => {
  const [isLoading, setIsLoading] = useState(true);

  if (isLoading) {
    return <Spinner size="large" />;
  }

  return <div>Content loaded!</div>;
};
```

### PlayButton

Audio playback component:

```typescript
import { PlayButton } from "@rimori/client";

const AudioPlayer = () => {
  return (
    <PlayButton
      audioUrl="https://example.com/audio.mp3"
      onPlay={() => console.log('Audio playing')}
      onPause={() => console.log('Audio paused')}
    />
  );
};
```

### AI Components

```typescript
import { Avatar, Assistant } from "@rimori/client";

const AIInterface = () => {
  return (
    <div>
      <Avatar
        name="AI Assistant"
        status="online"
        size="large"
      />

      <Assistant
        onMessage={(message) => console.log('AI message:', message)}
        placeholder="Ask the AI assistant..."
      />
    </div>
  );
};
```

## Hooks

### useChat

Manage AI chat conversations:

```typescript
import { useChat } from "@rimori/client";

const ChatExample = () => {
  const { messages, append, isLoading, setMessages } = useChat([
    // Optional tools for the AI
    {
      name: "get_weather",
      description: "Get current weather",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string" }
        }
      }
    }
  ]);

  const sendMessage = (content: string) => {
    append([{ role: 'user', content }]);
  };

  return (
    <div>
      {messages.map((msg, index) => (
        <div key={index}>{msg.content}</div>
      ))}
      {isLoading && <div>AI is typing...</div>}
    </div>
  );
};
```

### useTranslation

Internationalization (i18n) support built on i18next:

```typescript
import { useTranslation } from "@rimori/client";

const TranslatedComponent = () => {
  const { t, ready } = useTranslation();
 
  if (!ready) {
    return <div>Loading translations...</div>;
  }
 
  return (
    <div>
      <h1>{t('discussion.title')}</h1>
      <p>{t('discussion.whatToTalkAbout')}</p>
    </div>
  );
};
```

## Translation Feature

Rimori includes a comprehensive internationalization (i18n) system built on i18next that allows plugins to support multiple languages with minimal developer effort.

### How it works

- **Developer Focus**: Developers only need to ensure their interface works in English
- **Automatic Translations**: With every release, translations for all other languages are generated automatically
- **Local Testing**: For local development, you can test translations by:
  1. Setting your user language to a non-English locale (e.g., German)
  2. Creating a local translation file with "local-" prefix (e.g., `local-de.json`) in the `public/locales/` directory
  3. The translator will automatically use the local translation file in development mode
- **Manual Translations**: If developers want to manually translate files, they should place the language file manually in the `public/locales/` folder with the language code as filename (e.g., `de.json`, `fr.json`)

### Usage

#### Using the Hook (Recommended)

```typescript
import { useTranslation } from "@rimori/client";

function MyComponent() {
  const { t, ready } = useTranslation();
 
  if (!ready) {
    return <div>Loading translations...</div>;
  }
 
  return (
    <div>
      <h1>{t('discussion.title')}</h1>
      <p>{t('discussion.whatToTalkAbout')}</p>
    </div>
  );
}
```

#### Using the Translator Instance

```typescript
import { useRimori } from "@rimori/client";

const { plugin } = useRimori();
const translator = await plugin.getTranslator()

const translatedText = translator.t("discussion.title");
```

### Translation File Structure

- **Location**: `public/locales/`
- **Production Files**: Must be named `{language}.json` (e.g., `en.json`, `de.json`, `fr.json`)
- **Local Development Files**: Must be named `local-{language}.json` (e.g., `local-de.json`, `local-fr.json`)
- **Format**: Standard JSON with nested objects for organization
- **English Requirement**: `en.json` is required as the base language
- **Release Process**: Files starting with "local-" are ignored during the release process

Example translation file structure:

```json
{
  "discussion": {
    "title": "Discussion",
    "whatToTalkAbout": "What do you want to talk about?",
    "topics": {
      "everyday": {
        "title": "Everyday Conversations",
        "description": "Ordering coffee, asking for directions, etc."
      }
    }
  }
}
```

### Features

- **I18next Support**: All i18next features work with these translations including:
  - Variable interpolation: `{{name}}`
  - Pluralization
  - Fallback mechanisms
- **Automatic Fallback**: If a translation is missing, it falls back to English
- **Development Mode**: Local translation files are prioritized in development
- **Production Ready**: Automatic translation generation for production releases

### Limitations

- Only one translation file per language is allowed
- Namespaces are not supported
- Production translation files must be named `{language}.json` and placed in `public/locales/`
- Local development files must be named `local-{language}.json` and placed in `public/locales/`
- English (`en.json`) is required as the base language
- Local files (prefixed with "local-") are ignored during the release process

## Utilities

### difficultyConverter

Convert between different difficulty representations:

```typescript
import { difficultyConverter } from '@rimori/client';

const difficulty = difficultyConverter.toNumber('intermediate'); // Returns: 2
const difficultyText = difficultyConverter.toString(3); // Returns: 'advanced'
```

### PluginUtils

Various utility functions:

```typescript
import { PluginUtils } from '@rimori/client';

// Utility functions for common plugin operations
const utils = PluginUtils.getInstance();
// Access various helper methods
```

### Language Utilities

Language detection and processing:

```typescript
import { Language } from '@rimori/client';

// Language-related utility functions
const languageCode = Language.detectLanguage(text);
const isSupported = Language.isSupported('es');
```

## TypeScript Support

The package is fully typed with comprehensive TypeScript definitions:

```typescript
import type {
  MainPanelAction,
  Message,
  Tool,
  EventPayload,
  AccomplishmentPayload,
  SharedContent,
  BasicAssignment,
  UserInfo,
} from '@rimori/client';

// All interfaces and types are exported for use in your plugin
interface MyPluginData extends SharedContent<any> {
  // Your custom properties
}
```

The SharedContent has this type definition:

```
export interface SharedContent<T> {
  /** The type/category of the content (e.g. 'grammar_exercises', 'flashcards', etc.) */
  contentType: string;

  /** The human readable title/topic of the content */
  topic: string;

  /** Array of keywords/tags associated with the content for search and categorization */
  keywords: string[];

  /** The actual content data of type T */
  data: T;

  /** Whether this content should only be visible to the creator. Defaults to false if not specified */
  privateTopic?: boolean;
}
```

## Examples

### Complete Plugin Example

```typescript
import React, { useState, useEffect } from 'react';
import {
  PluginProvider,
  usePlugin,
  MarkdownEditor,
  Spinner,
  useChat
} from '@rimori/client';
import { HashRouter, Route, Routes } from 'react-router-dom';

const StudyNotesPlugin = () => {
  const { db, llm, plugin, community } = useRimori();
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { messages, append } = useChat();

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      const { data } = await db.from('notes').select('*').order('created_at', { ascending: false });
      setNotes(data || []);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveNote = async (content: string) => {
    const { data } = await db.from('notes').insert({
      content,
      created_at: new Date().toISOString()
    }).select().single();

    setNotes([data, ...notes]);

    // Share with community
    await community.sharedContent.create({
      content_type: 'study_notes',
      content: { text: content },
      metadata: { wordCount: content.length }
    });
  };

  const generateSummary = async (noteContent: string) => {
    const summary = await llm.getText([
      { role: 'user', content: `Summarize this study note: ${noteContent}` }
    ]);

    return summary;
  };

  if (isLoading) return <Spinner size="large" />;

  return (
    <div className="study-notes-plugin">
      <h1>Study Notes</h1>

      <div className="notes-grid">
        {notes.map(note => (
          <div key={note.id} className="note-card">
            <MarkdownEditor
              value={note.content}
              onChange={(content) => {/* Update logic */}}
            />
            <button onClick={() => generateSummary(note.content)}>
              Generate Summary
            </button>
          </div>
        ))}
      </div>

      <div className="ai-chat">
        <h2>Study Assistant</h2>
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
        <button onClick={() => append([{ role: 'user', content: 'Help me study' }])}>
          Get Study Help
        </button>
      </div>
    </div>
  );
};

const App = () => (
  <PluginProvider pluginId="study-notes-plugin">
    <HashRouter>
      <Routes>
        <Route path="/" element={<StudyNotesPlugin />} />
      </Routes>
    </HashRouter>
  </PluginProvider>
);

export default App;
```

## Best Practices

1. **Performance**: Use lazy loading for pages and implement proper loading states
2. **State Management**: Leverage React hooks and context when needed
3. **Type Safety**: Use TypeScript interfaces for all data structures
4. **Event Cleanup**: Always unsubscribe from events in useEffect cleanup
5. **Responsive Design**: Use TailwindCSS classes for responsive layouts
