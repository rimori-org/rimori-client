# Rimori Client Package

The `@rimori/client` package is the framework-agnostic runtime and CLI that powers Rimori plugins. Use it inside plugin iframes, workers, and build scripts to access Rimori platform features such as database access, AI, shared content, and the event bus. All React-specific helpers and UI components are now published separately in `@rimori/react-client`.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Relationship to @rimori/react-client](#relationship-to-rimori-react-client)
- [Quick Start](#quick-start)
- [CLI Tooling](#cli-tooling)
- [Runtime API](#runtime-api)
  - [Bootstrapping](#bootstrapping)
  - [Plugin Interface](#plugin-interface)
  - [Database Access](#database-access)
  - [AI & Voice](#ai--voice)
  - [Event Bus & Actions](#event-bus--actions)
  - [Community Content](#community-content)
  - [Workers & Standalone Development](#workers--standalone-development)
- [Utilities](#utilities)
- [TypeScript Support](#typescript-support)
- [Example Integration](#example-integration)
- [Troubleshooting](#troubleshooting)

## Overview

`@rimori/client` gives you direct, typed access to the Rimori platform:

- Bootstrap authenticated plugin sessions and fetch Rimori context.
- Run Supabase queries against your plugin's dedicated schema.
- Call AI services for text, structured data, or voice.
- Communicate with Rimori and other plugins through the event bus.
- Share content with the community and emit accomplishments.
- Ship and upgrade plugins by using the bundled CLI.

## Installation

```bash
npm install @rimori/client
# or
yarn add @rimori/client
```

## Relationship to @rimori/react-client

If you are building a React-based plugin UI, install the companion package:

```bash
npm install @rimori/react-client
```

`@rimori/react-client` wraps this core runtime with React context, hooks, and prebuilt UI components. Use it for UI concerns (`PluginProvider`, `useRimori`, `useChat`, widgets). Keep importing non-UI functionality such as `RimoriClient`, `StandaloneClient`, `setupWorker`, or the CLI directly from `@rimori/client`.

## Quick Start

Instantiate the client once in your application entry point and reuse it everywhere:

```ts
import { RimoriClient } from '@rimori/client';

async function bootstrap() {
  const client = await RimoriClient.getInstance('your-plugin-id');

  const user = client.plugin.getUserInfo();
  const { data } = await client.db.from('notes').select('*').eq('user_id', user.profile_id);

  console.log('Loaded notes', data);
}

bootstrap().catch(console.error);
```

The instance exposes high-level controllers grouped under properties such as `plugin`, `db`, `ai`, `event`, `community`, `runtime`, and `navigation`.

## CLI Tooling

Two CLI commands ship with the package (also available through `npx`):

### `rimori-init`

- Authenticates against Rimori using your developer credentials.
- Registers the plugin and writes the plugin ID (`r_id`) into `package.json`.
- Provisions environment files, Vite/Tailwind scaffolding, worker configuration, and sample assets.

Usage:

```bash
npx @rimori/client rimori-init
npx @rimori/client rimori-init --upgrade   # refresh config without changing the plugin ID
```

### `rimori-release`

- Builds (optionally) and uploads the plugin bundle to Rimori.
- Updates release metadata, database migrations, and activates the chosen channel (`alpha`, `beta`, `stable`).

Usage:

```bash
yarn build
npx @rimori/client rimori-release alpha
```

During initialization, convenience scripts (`release:alpha`, `release:beta`, `release:stable`) are added to your project automatically.

## Runtime API

### Bootstrapping

- `RimoriClient.getInstance(pluginId)` – connect the sandboxed iframe to Rimori.
- `StandaloneClient` – authenticate when developing a plugin outside Rimori.
- `setupWorker()` – register worker scripts that need the Rimori runtime.

### Plugin Interface

Access metadata and settings through `client.plugin`:

- `plugin.pluginId` – current plugin identifier.
- `plugin.getSettings(defaults)` / `plugin.setSettings(settings)` – persist configuration.
- `plugin.getPluginInfo()` – read active/installed plugin information.
- `plugin.getUserInfo()` – obtain user profile details (language, name, guild, etc.).
- `plugin.getTranslator()` – lazily initialize the translator for manual i18n.

### Database Access

`client.db` wraps the Supabase client that is scoped to your plugin tables:

```ts
const { data, error } = await client.db.from('study_sessions').select('*').order('completed_at', { ascending: false });
```

Helpers:

- `db.tablePrefix` – plugin-specific prefix applied to all tables.
- `db.getTableName("notes")` – resolve the fully qualified table name.
- Supabase query builder methods (`insert`, `update`, `delete`, `eq`, `limit`, etc.) are available out of the box.

### AI & Voice

The `client.ai` controller surfaces AI capabilities:

- `getText(messages, tools?)` – chat completion (string result).
- `getSteamedText(messages, onMessage, tools?)` – streamed responses.
- `getObject(request)` – structured JSON generation.
- `getVoice(text, voice?, speed?, language?)` – text-to-speech (returns `Blob`).
- `getTextFromVoice(file)` – speech-to-text transcription.

Use `client.runtime.fetchBackend` for authenticated calls to Rimori-managed HTTP endpoints.

### Event Bus & Actions

`client.event` lets you collaborate with Rimori and other plugins:

- `emit(topic, data?)`, `request(topic, data?)` – publish and request data.
- `on(topic, handler)` / `once(topic, handler)` / `respond(topic, handler)` – subscribe and reply (each call returns an object with `off()` for cleanup).
- `emitAccomplishment(payload)` / `onAccomplishment(topic, handler)` – report learning milestones.
- `emitSidebarAction(pluginId, actionKey, text?)` – trigger sidebar plugins.
- `onMainPanelAction(handler, actionsToListen?)` – react to dashboard actions.
- `client.navigation.toDashboard()` – navigate the user back to Rimori.

### Community Content

`client.community.sharedContent` exposes helpers to share or consume content:

- `get(contentType, id)`
- `getList(contentType, filter?, limit?)`
- `getNew(contentType, instructions, filter?, options?)`
- `create(payload)`
- `update(id, payload)`
- `remove(id)`
- `complete(contentType, assignmentId)`

The controller handles topic generation, metadata, and completion tracking automatically.

### Workers & Standalone Development

- `setupWorker()` wires the Rimori event bus into worker contexts.
- `StandaloneClient.getInstance()` signs in against Rimori when your plugin runs outside the platform (e.g., local development).
- `client.getQueryParam(key)` reads values provided by Rimori through the sandbox handshake (such as `applicationMode` or theme information).

## Utilities

Import additional helpers as needed:

- `AudioController` – high-level audio playback/recording utilities for non-React environments.
- `Translator` – encapsulated i18next integration for manual translation flows.
- `difficultyConverter` – convert between textual and numeric difficulty levels.
- Type definitions for AI messages, shared content, triggers, accomplishments, and more.

## TypeScript Support

All exports are fully typed. You can import the type definitions directly:

```ts
import type { Message, Tool, SharedContent, MacroAccomplishmentPayload } from '@rimori/client';
```

The generated declaration files cover every controller and helper to keep plugins strictly typed.

## Example Integration

React users should install `@rimori/react-client` and wrap their app:

```tsx
import { PluginProvider, useRimori, useChat } from '@rimori/react-client';

function Dashboard() {
  const client = useRimori();
  const { messages, append } = useChat();

  // interact with the core API through the client instance
  // e.g. client.db.from("notes")...
}

export function App() {
  return (
    <PluginProvider pluginId="your-plugin-id">
      <Dashboard />
    </PluginProvider>
  );
}
```

Non-React projects can interact with the same client instance directly via the examples in the sections above.

## Troubleshooting

- **`ReferenceError: process is not defined` in workers** – ensure worker bundles only import from `@rimori/client`. Packages that reference `process.env` are not compatible with Rimori workers.
- **Missing plugin ID or token** – re-run `rimori-init` to regenerate configuration and authentication secrets.
- **Event bus listeners firing twice** – store the listener returned by `event.on` and call `listener.off()` during cleanup (React users get this cleanup inside the hooks provided by `@rimori/react-client`).
