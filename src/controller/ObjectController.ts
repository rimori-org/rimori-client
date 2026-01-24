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
export type ObjectTool = {
  [key: string]: ObjectToolParameter;
};

export interface ObjectRequest {
  /**
   * The tools that the AI can use.
   */
  tool: ObjectTool;
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

export async function generateObject<T = any>(
  backendUrl: string,
  request: ObjectRequest,
  token: string,
  cache = false,
): Promise<T> {
  return await fetch(`${backendUrl}/ai/llm-object`, {
    method: 'POST',
    body: JSON.stringify({
      stream: false,
      tool: request.tool,
      behaviour: request.behaviour,
      instructions: request.instructions,
      cache,
    }),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }).then((response) => response.json());
}

export type OnStreamedObjectResult<T = any> = (result: T, isLoading: boolean) => void;

const tryParseJson = <T>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const mergeStreamObject = (base: any, patch: any): any => {
  if (Array.isArray(patch)) {
    return patch.map((item, index) => mergeStreamObject(base?.[index], item));
  }

  if (patch && typeof patch === 'object') {
    const result: Record<string, any> = base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {};

    for (const [key, value] of Object.entries(patch)) {
      result[key] = mergeStreamObject(result[key], value);
    }

    return result;
  }

  return patch;
};

const applyStreamChunk = <T>(current: T, chunk: any): { next: T; updated: boolean } => {
  if (!chunk || typeof chunk !== 'object') {
    return { next: current, updated: false };
  }

  if (chunk.object && typeof chunk.object === 'object') {
    return { next: chunk.object as T, updated: true };
  }

  if (chunk.delta && typeof chunk.delta === 'object') {
    return { next: mergeStreamObject(current, chunk.delta) as T, updated: true };
  }

  if (chunk.value && typeof chunk.value === 'object') {
    return { next: mergeStreamObject(current, chunk.value) as T, updated: true };
  }

  return { next: current, updated: false };
};

export async function streamObject<T = any>(
  backendUrl: string,
  request: ObjectRequest,
  onResult: OnStreamedObjectResult<T>,
  token: string,
  cache = false,
): Promise<void> {
  const response = await fetch(`${backendUrl}/ai/llm-object`, {
    method: 'POST',
    body: JSON.stringify({
      stream: true,
      tool: request.tool,
      behaviour: request.behaviour,
      instructions: request.instructions,
      cache,
    }),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    console.error('Failed to stream object:', response.status, response.statusText);
    return;
  }

  if (!response.body) {
    console.error('No response body.');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');

  let done = false;
  let currentObject: any = {};

  while (!done) {
    const { value, done: readerDone } = await reader.read();

    if (value) {
      const chunk = decoder.decode(value, { stream: true });

      const lines = chunk.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        const dataStr = line.substring(5).trim();

        if (dataStr === '[DONE]') {
          done = true;
          break;
        }

        currentObject = JSON.parse(dataStr);
        onResult(currentObject, true);
      }
    }

    if (readerDone) {
      done = true;
    }
  }
  onResult(currentObject, false);
}
