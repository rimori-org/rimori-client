import { Language } from './PluginModule';
import { Tool } from '../../fromRimori/PluginTypes';
import { RimoriCommunicationHandler } from '../CommunicationHandler';

export type OnStreamedObjectResult<T = any> = (result: T, isLoading: boolean) => void;

interface ToolResult {
  toolCallId: string;
  toolName: string;
  args: any;
}

type PrimitiveType = 'string' | 'number' | 'boolean';

// This is the type that can appear in the `type` property
type ObjectToolParameterType =
  | PrimitiveType
  | { [key: string]: ObjectToolParameter } // for nested objects
  | [{ [key: string]: ObjectToolParameter }]; // for arrays of objects (notice the tuple type)

interface ObjectToolParameter {
  type: ObjectToolParameterType;
  description?: string;
  enum?: string[];
  optional?: boolean;
}

/**
 * The tools that the AI can use.
 *
 * The key is the name of the tool.
 * The value is the parameter of the tool.
 *
 */
export type AIObjectTool = {
  [key: string]: ObjectToolParameter;
};

export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args: Record<string, string>;
}

export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolInvocation[];
}

export type OnLLMResponse = (
  id: string,
  response: string,
  finished: boolean,
  toolInvocations?: ToolInvocation[],
) => void;

/**
 * Controller for AI-related operations.
 * Provides access to text generation, voice synthesis, and object generation.
 */
export class AIModule {
  private controller: RimoriCommunicationHandler;
  private sessionTokenId: string | null = null;
  private onRateLimitedCb?: (exercisesRemaining: number) => void;

  constructor(controller: RimoriCommunicationHandler) {
    this.controller = controller;
  }

  /**
   * Resolves a prompt name following the event naming convention:
   * - 2-segment names (e.g. 'storytelling.story') get prefixed with pluginId → '<pluginId>.storytelling.story'
   * - 3+ segment names starting with 'global.' (e.g. 'global.translator.translate') are sent as-is
   */
  private resolvePromptName(name: string): string {
    if (name.startsWith('global.')) return name;
    const segments = name.split('.');
    if (segments.length === 2 && this.controller.pluginId) {
      return `${this.controller.pluginId}.${name}`;
    }
    return name;
  }

  /** Exercise session management. */
  public readonly session = {
    /** Returns the current exercise session token ID (null if no active session). */
    get: (): string | null => this.sessionTokenId,

    /** Sets the session token ID. */
    set: (id: string): void => {
      this.sessionTokenId = id;
    },

    /** Clears the stored session token. */
    clear: (): void => {
      this.sessionTokenId = null;
    },

    /**
     * Ensures a session token exists, creating one from the backend if needed.
     * Mirrors the lazy-issuance pattern used by the AI/LLM endpoint.
     */
    ensure: async (): Promise<void> => {
      if (this.sessionTokenId) return;

      const response = await fetch(`${this.backendUrl}/ai/session`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.getToken()}` },
      });

      if (!response.ok) {
        if (response.status === 429) {
          const body = await response.json().catch(() => ({}));
          const remaining = body.exercises_remaining ?? 0;
          this.onRateLimitedCb?.(remaining);
          throw new Error(
            `Rate limit exceeded: ${body.error ?? 'Daily exercise limit reached'}. exercises_remaining: ${remaining}`,
          );
        }
        throw new Error(`Failed to create session: ${response.status} ${response.statusText}`);
      }

      const { session_token_id } = await response.json();
      this.sessionTokenId = session_token_id;
    },
  };

  /** Registers a callback invoked whenever a 429 rate-limit response is received. */
  setOnRateLimited(cb: (exercisesRemaining: number) => void): void {
    this.onRateLimitedCb = cb;
  }

  /**
   * Generate text from messages using AI.
   * @param params.messages The messages to generate text from.
   * @param params.tools Optional tools to use for generation.
   * @param params.cache Whether to cache the result (default: false).
   * @param params.prompt Server-side prompt name (e.g. 'writing.analysis').
   * @param params.variables Variables for the server-side prompt template.
   * @returns The generated text.
   */
  async getText(params: {
    messages: Message[];
    tools?: Tool[];
    cache?: boolean;
    prompt?: string;
    variables?: Record<string, any>;
  }): Promise<string> {
    const { messages, tools, cache = false, prompt, variables } = params;
    const { result } = await this.streamObject<{ result: string }>({
      cache,
      tools,
      messages,
      prompt,
      variables,
    });

    return result;
  }

  /**
   * Stream text generation from messages using AI.
   * @param params.messages The messages to generate text from.
   * @param params.onMessage Callback for each message chunk.
   * @param params.tools Optional tools to use for generation.
   * @param params.cache Whether to cache the result (default: false).
   * @param params.prompt Server-side prompt name (e.g. 'writing.analysis').
   * @param params.variables Variables for the server-side prompt template.
   */
  async getStreamedText(params: {
    messages: Message[];
    onMessage: OnLLMResponse;
    tools?: Tool[];
    cache?: boolean;
    prompt?: string;
    variables?: Record<string, any>;
  }): Promise<string> {
    const {
      messages,
      onMessage,
      tools,
      cache = false,
      prompt,
      variables,
    } = params;
    const messageId = Math.random().toString(36).substring(3);

    const { result } = await this.streamObject<{ result: string }>({
      cache,
      tools,
      messages,
      prompt,
      variables,
      onResult: ({ result }) => onMessage(messageId, result, false),
    });

    onMessage(messageId, result, true);
    return result;
  }

  /**
   * Generate voice audio from text using AI.
   * @param text The text to convert to voice.
   * @param voice The voice to use (default: 'alloy').
   * @param speed The speed of the voice (default: 1).
   * @param language Optional language for the voice.
   * @param cache Whether to cache the result (default: false).
   * @returns The generated audio as a Blob.
   *
   * **Empty input:** If `text` is empty or whitespace-only, no network request is
   * made and an empty `Blob` is returned immediately. This prevents a 400 error
   * from the TTS backend while keeping the caller's workflow intact.
   * A warning is logged to the console in this case.
   */
  async getVoice(
    text: string,
    voice = 'alloy',
    speed = 1,
    language?: string,
    cache = false,
    instructions?: string,
  ): Promise<Blob> {
    if (!text.trim().length) {
      console.warn('[rimori-client] getVoice called with empty text — skipping TTS request and returning empty Blob.');
      return new Blob([], { type: 'audio/mpeg' });
    }
    await this.session.ensure();
    return await this.controller.fetchBackend('/voice/tts', {
      method: 'POST',
      body: JSON.stringify({
        input: text,
        voice,
        speed,
        language,
        cache,
        instructions,
        session_token_id: this.sessionTokenId ?? undefined,
      }),
    }).then((r) => r.blob());
  }

  /**
   * Convert voice audio to text using AI.
   * @param file The audio file to convert.
   * @param language Optional language for the voice.
   * @returns The transcribed text.
   */
  async getTextFromVoice(file: Blob, language?: Language): Promise<string> {
    await this.session.ensure();
    const formData = new FormData();
    formData.append('file', file);
    if (language) {
      formData.append('language', language.code);
    }
    if (this.sessionTokenId) {
      formData.append('session_token_id', this.sessionTokenId);
    }
    return await this.controller.fetchBackend('/voice/stt', {
      method: 'POST',
      body: formData,
    })
      .then((r) => r.json())
      .then((r) => {
        // console.log("STT response: ", r);
        return r.text;
      });
  }

  /**
   * Generate a structured object from a request using AI.
   * @param request.cache Whether to cache the result (default: false).
   * @param request.tools The tools to use for generation.
   * @param request.prompt Server-side prompt name (e.g. 'writing.analysis').
   * @param request.variables Variables for the server-side prompt template.
   * @returns The generated object.
   */
  async getObject<T = any>(params: {
    cache?: boolean;
    tools?: Tool[];
    prompt?: string;
    variables?: Record<string, any>;
  }): Promise<T> {
    const { cache = false, tools = [], prompt, variables } = params;
    return await this.streamObject<T>({
      messages: [],
      cache,
      tools,
      prompt,
      variables,
    });
  }

  /**
   * Generate a streamed structured object from a request using AI.
   * @param request.onResult Callback for each result chunk.
   * @param request.cache Whether to cache the result (default: false).
   * @param request.tools The tools to use for generation.
   * @param request.prompt Server-side prompt name (e.g. 'writing.analysis').
   * @param request.variables Variables for the server-side prompt template.
   */
  async getStreamedObject<T = any>(params: {
    onResult: OnStreamedObjectResult<T>;
    cache?: boolean;
    tools?: Tool[];
    prompt?: string;
    variables?: Record<string, any>;
  }): Promise<T> {
    const { onResult, cache = false, tools = [], prompt, variables } = params;
    return await this.streamObject<T>({
      messages: [],
      onResult,
      cache,
      tools,
      prompt,
      variables,
    });
  }

  private async streamObject<T = any>(params: {
    messages: Message[];
    onResult?: OnStreamedObjectResult<T>;
    cache?: boolean;
    tools?: Tool[];
    prompt?: string;
    variables?: Record<string, any>;
  }): Promise<T> {
    const {
      messages,
      onResult = () => null,
      cache = false,
      tools = [],
      prompt,
      variables,
    } = params;
    const chatMessages = messages.map((message, index) => ({
      ...message,
      id: `${index + 1}`,
    }));

    const payload: Record<string, any> = {
      cache,
      tools,
      stream: true,
      messages: chatMessages,
      session_token_id: this.sessionTokenId ?? undefined,
    };

    if (prompt) {
      payload.prompt = { name: this.resolvePromptName(prompt), variables: variables ?? {} };
    }

    const response = await this.controller.fetchBackend('/ai/llm', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status === 429) {
        const body = await response.json().catch(() => ({}));
        const remaining = body.exercises_remaining ?? 0;
        this.onRateLimitedCb?.(remaining);
        throw new Error(
          `Rate limit exceeded: ${body.error ?? 'Daily exercise limit reached'}. exercises_remaining: ${remaining}`,
        );
      }
      throw new Error(`Failed to stream object: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let currentObject: T = {} as T;

    // Buffer for SSE lines that are split across network chunks.
    // TCP/IP does not guarantee that each `read()` call delivers a complete
    // logical line. For example, the `token:` line carrying the session token
    // may arrive as two separate chunks:
    //   chunk 1 → `token: {"token_id":`
    //   chunk 2 → `"abc123"}\n`
    // Without buffering, `JSON.parse` would throw on the partial line and the
    // session token would be silently discarded, causing the next LLM call to
    // start without a session (triggering an unnecessary extra round-trip via
    // `session.ensure()`). By keeping the incomplete tail in `lineBuffer` and
    // prepending it to the next chunk we always process whole lines.
    let lineBuffer = '';

    let isLoading = true;
    while (isLoading) {
      //wait 50ms to not overload the CPU
      await new Promise((resolve) => setTimeout(resolve, 30));

      const { value, done: readerDone } = await reader.read();

      if (readerDone) {
        isLoading = false;
        onResult(currentObject, false);
        return currentObject;
      }
      //the check needs to be behind readerDone because in closed connections the value is undefined
      if (!value) continue;

      const chunk = decoder.decode(value, { stream: true });
      // Prepend any incomplete line left over from the previous chunk, then
      // split on newlines. `parts.pop()` removes (and saves) the last element
      // which may be an incomplete line if the chunk did not end with '\n'.
      const combined = lineBuffer + chunk;
      const parts = combined.split('\n');
      lineBuffer = parts.pop() ?? '';
      const lines = parts.filter((line) => line.trim());

      for (const line of lines) {
        // Handle token: line (session token issued by backend on first AI call)
        if (line.startsWith('token:')) {
          try {
            const tokenData = JSON.parse(line.slice(6).trim());
            if (tokenData.token_id) {
              this.sessionTokenId = tokenData.token_id;
            }
          } catch {
            console.error('Failed to parse token: line', line);
          }
          continue;
        }

        // Handle debug: line (prompt resolution debug info, dev/local only)
        if (line.startsWith('debug:')) {
          try {
            const debug = JSON.parse(line.slice(6).trim());
            console.group(`[Rimori Prompt] ${debug.promptName}`);
            console.log('System prompt:\n', debug.system);
            console.log('User prompt:\n', debug.user);
            console.log('Variables:', debug.variables);
            console.groupEnd();
          } catch {
            // Ignore malformed debug lines
          }
          continue;
        }

        const command = line.substring(0, 5);
        const dataStr = line.substring(5).trim();

        if (dataStr === '[DONE]') {
          isLoading = false;
          onResult(currentObject, false);
          return currentObject;
        }

        if (command === 'data:') {
          currentObject = JSON.parse(dataStr) as T;
          onResult(currentObject, true);
        } else if (command === 'tool:') {
          const { toolCallId, toolName, args } = JSON.parse(dataStr) as ToolResult;
          const tool = tools.find((tool) => tool.name === toolName);

          if (tool && tool.execute) {
            const result = await tool.execute(args);
            // Send the result to the backend
            await this.sendToolResult(toolCallId, result);
          } else if (tool && !tool.execute) {
            console.error('Tool found but has no execute function:', toolName);
          } else {
            console.error('Tool not found:', toolName);
          }
        } else if (command === 'error') {
          //error has 5 letters + the colon so we need to remove one character of the data string to get the error message
          console.error('Error:', dataStr.substring(1));
        } else if (command === 'info:') {
          //ignore info messages
        } else {
          console.error('Unknown stream data:', line);
        }
      }
    }
    return currentObject;
  }

  private async sendToolResult(toolCallId: string, result: any): Promise<void> {
    await this.controller.fetchBackend('/ai/llm/tool_result', {
      method: 'POST',
      body: JSON.stringify({ toolCallId, result: result ?? '[DONE]' }),
    });
  }
}
