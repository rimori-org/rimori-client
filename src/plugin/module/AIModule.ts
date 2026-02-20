import { Tool } from '../../fromRimori/PluginTypes';
import { Language } from '../../controller/SettingsController';

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

export interface ObjectRequest {
  /**
   * The tools that the AI can use.
   */
  tool: AIObjectTool;
  /**
   * High level instructions for the AI to follow. Behaviour, tone, restrictions, etc.
   * Example: "Act like a recipe writer."
   */
  behaviour?: string;
  /**
   * The specific instruction for the AI to follow.
   * Example: "Generate a recipe using chicken, rice and vegetables."
   */
  instructions: string;
}

/**
 * Controller for AI-related operations.
 * Provides access to text generation, voice synthesis, and object generation.
 */
export class AIModule {
  private getToken: () => string;
  private backendUrl: string;
  private sessionTokenId: string | null = null;
  private onRateLimitedCb?: (exercisesRemaining: number) => void;

  constructor(backendUrl: string, getToken: () => string) {
    this.backendUrl = backendUrl;
    this.getToken = getToken;
  }

  /** Returns the current exercise session token ID (null if no active session). */
  getSessionTokenId(): string | null {
    return this.sessionTokenId;
  }

  /** Sets the session token ID (used by workers inheriting a session from the plugin). */
  setSessionToken(id: string): void {
    this.sessionTokenId = id;
  }

  /** Clears the stored session token (called after macro accomplishment). */
  clearSessionToken(): void {
    this.sessionTokenId = null;
  }

  /** Registers a callback invoked whenever a 429 rate-limit response is received. */
  setOnRateLimited(cb: (exercisesRemaining: number) => void): void {
    this.onRateLimitedCb = cb;
  }

  /**
   * Generate text from messages using AI.
   * @param messages The messages to generate text from.
   * @param tools Optional tools to use for generation.
   * @param cache Whether to cache the result (default: false).
   * @param model The model to use for generation.
   * @returns The generated text.
   */
  async getText(messages: Message[], tools?: Tool[], cache = false, model?: string): Promise<string> {
    const { result } = await this.streamObject<{ result: string }>({
      cache,
      tools,
      model,
      messages,
      responseSchema: {
        result: {
          type: 'string',
        },
      },
    });

    return result;
  }

  /**
   * Stream text generation from messages using AI.
   * @param messages The messages to generate text from.
   * @param onMessage Callback for each message chunk.
   * @param tools Optional tools to use for generation.
   * @param cache Whether to cache the result (default: false).
   * @param model The model to use for generation.
   */
  async getSteamedText(
    messages: Message[],
    onMessage: OnLLMResponse,
    tools?: Tool[],
    cache = false,
    model?: string,
    knowledgeId?: string,
  ): Promise<void> {
    const messageId = Math.random().toString(36).substring(3);

    const { result } = await this.streamObject<{ result: string }>({
      cache,
      tools,
      model,
      messages,
      knowledgeId,
      responseSchema: {
        result: {
          type: 'string',
        },
      },
      onResult: ({ result }) => onMessage(messageId, result, false),
    });

    onMessage(messageId, result, true);
  }

  /**
   * Generate voice audio from text using AI.
   * @param text The text to convert to voice.
   * @param voice The voice to use (default: 'alloy').
   * @param speed The speed of the voice (default: 1).
   * @param language Optional language for the voice.
   * @param cache Whether to cache the result (default: false).
   * @returns The generated audio as a Blob.
   */
  async getVoice(text: string, voice = 'alloy', speed = 1, language?: string, cache = false): Promise<Blob> {
    return await fetch(`${this.backendUrl}/voice/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getToken()}`,
      },
      body: JSON.stringify({ input: text, voice, speed, language, cache, session_token_id: this.sessionTokenId ?? undefined }),
    }).then((r) => r.blob());
  }

  /**
   * Convert voice audio to text using AI.
   * @param file The audio file to convert.
   * @param language Optional language for the voice.
   * @returns The transcribed text.
   */
  async getTextFromVoice(file: Blob, language?: Language): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    if (language) {
      formData.append('language', language.code);
    }
    if (this.sessionTokenId) {
      formData.append('session_token_id', this.sessionTokenId);
    }
    return await fetch(`${this.backendUrl}/voice/stt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.getToken()}` },
      body: formData,
    })
      .then((r) => r.json())
      .then((r) => {
        // console.log("STT response: ", r);
        return r.text;
      });
  }

  private getChatMessage(systemPrompt: string, userPrompt?: string): Message[] {
    const messages: Message[] = [{ role: 'system', content: systemPrompt }];
    if (userPrompt) {
      messages.push({ role: 'user', content: userPrompt } as Message);
    }
    return messages;
  }
  /**
   * Generate a structured object from a request using AI.
   * @param request The object generation request.
   * @param request.systemPrompt The system prompt to use for generation.
   * @param request.responseSchema The response schema to use for generation.
   * @param request.userPrompt The user prompt to use for generation.
   * @param request.cache Whether to cache the result (default: false).
   * @param request.tools The tools to use for generation.
   * @param request.model The model to use for generation.
   * @returns The generated object.
   */
  async getObject<T = any>(params: {
    systemPrompt: string;
    responseSchema: AIObjectTool;
    userPrompt?: string;
    cache?: boolean;
    tools?: Tool[];
    model?: string;
    knowledgeId?: string;
  }): Promise<T> {
    const {
      systemPrompt,
      responseSchema,
      userPrompt,
      cache = false,
      tools = [],
      model = undefined,
      knowledgeId,
    } = params;
    return await this.streamObject<T>({
      responseSchema,
      messages: this.getChatMessage(systemPrompt, userPrompt),
      cache,
      tools,
      model,
      knowledgeId,
    });
  }

  /**
   * Generate a streamed structured object from a request using AI.
   * @param request The object generation request.
   * @param request.systemPrompt The system prompt to use for generation.
   * @param request.responseSchema The response schema to use for generation.
   * @param request.userPrompt The user prompt to use for generation.
   * @param request.onResult Callback for each result chunk.
   * @param request.cache Whether to cache the result (default: false).
   * @param request.tools The tools to use for generation.
   * @param request.model The model to use for generation.
   * @param request.knowledgeId Optional knowledge entry ID to ground AI content in real facts.
   */
  async getStreamedObject<T = any>(params: {
    systemPrompt: string;
    responseSchema: AIObjectTool;
    userPrompt?: string;
    onResult: OnStreamedObjectResult<T>;
    cache?: boolean;
    tools?: Tool[];
    model?: string;
    knowledgeId?: string;
  }): Promise<void> {
    const {
      systemPrompt,
      responseSchema,
      userPrompt,
      onResult,
      cache = false,
      tools = [],
      model = undefined,
      knowledgeId,
    } = params;
    await this.streamObject<T>({
      responseSchema,
      messages: this.getChatMessage(systemPrompt, userPrompt),
      onResult,
      cache,
      tools,
      model,
      knowledgeId,
    });
  }

  private async streamObject<T = any>(params: {
    responseSchema: AIObjectTool;
    messages: Message[];
    onResult?: OnStreamedObjectResult<T>;
    cache?: boolean;
    tools?: Tool[];
    model?: string;
    knowledgeId?: string;
  }): Promise<T> {
    const {
      messages,
      responseSchema,
      onResult = () => null,
      cache = false,
      tools = [],
      model = undefined,
      knowledgeId,
    } = params;
    const chatMessages = messages.map((message, index) => ({
      ...message,
      id: `${index + 1}`,
    }));
    const response = await fetch(`${this.backendUrl}/ai/llm`, {
      body: JSON.stringify({
        cache,
        tools,
        stream: true,
        responseSchema,
        messages: chatMessages,
        model,
        knowledge_id: knowledgeId,
        session_token_id: this.sessionTokenId ?? undefined,
      }),
      method: 'POST',
      headers: { Authorization: `Bearer ${this.getToken()}`, 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      if (response.status === 429) {
        const body = await response.json().catch(() => ({}));
        const remaining = body.exercises_remaining ?? 0;
        this.onRateLimitedCb?.(remaining);
        throw new Error(`Rate limit exceeded: ${body.error ?? 'Daily exercise limit reached'}. exercises_remaining: ${remaining}`);
      }
      throw new Error(`Failed to stream object: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('No response body.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let currentObject: T = {} as T;

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
      const lines = chunk.split('\n').filter((line) => line.trim());

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
    await fetch(`${this.backendUrl}/ai/llm/tool_result`, {
      method: 'POST',
      body: JSON.stringify({
        toolCallId,
        result: result ?? '[DONE]',
      }),
      headers: { Authorization: `Bearer ${this.getToken()} `, 'Content-Type': 'application/json' },
    });
  }
}
