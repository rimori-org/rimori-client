import { Tool } from '../fromRimori/PluginTypes';

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

export async function generateText(
  backendUrl: string,
  messages: Message[],
  tools: Tool[],
  token: string,
  cache: boolean = false,
) {
  const response = await fetch(`${backendUrl}/ai/llm`, {
    method: 'POST',
    body: JSON.stringify({ messages, tools, cache }),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });

  return await response.json();
}

export type OnLLMResponse = (
  id: string,
  response: string,
  finished: boolean,
  toolInvocations?: ToolInvocation[],
) => void;

export async function streamChatGPT(
  backendUrl: string,
  messages: Message[],
  tools: Tool[],
  onResponse: OnLLMResponse,
  token: string,
  cache: boolean = false,
) {
  const messageId = Math.random().toString(36).substring(3);
  const currentMessages: Message[] = [...messages];

  console.log('Starting streamChatGPT with:', {
    messageId,
    messageCount: messages.length,
    toolCount: tools.length,
    backendUrl,
  });

  while (true) {
    const messagesForApi = currentMessages.map(({ id, ...rest }) => rest);

    try {
      const response = await fetch(`${backendUrl}/ai/llm`, {
        method: 'POST',
        body: JSON.stringify({ messages: messagesForApi, tools, stream: true, cache }),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        console.error('No response body.');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');

      let content = '';
      let done = false;
      const toolInvocations: { toolCallId: string; toolName: string; args: any }[] = [];
      let currentTextId = '';
      let isToolCallMode = false;
      let buffer = ''; // Buffer for incomplete chunks

      while (!done) {
        const { value, done: readerDone } = await reader.read();

        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Split by lines, but handle incomplete lines
          const lines = buffer.split('\n');

          // Keep the last line in buffer if it's incomplete
          if (lines.length > 1) {
            buffer = lines.pop() || '';
          }

          for (const line of lines) {
            if (line.trim() === '') continue;

            // Handle the new streaming format
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6); // Remove 'data: ' prefix

              // Handle [DONE] marker
              if (dataStr === '[DONE]') {
                done = true;
                break;
              }

              try {
                const data = JSON.parse(dataStr);

                // Log the first message to understand the format
                if (!content && !isToolCallMode) {
                  // console.log('First stream message received:', data);
                }

                switch (data.type) {
                  case 'start':
                    // Stream started, no action needed
                    // console.log('Stream started');
                    break;

                  case 'start-step':
                    // Step started, no action needed
                    // console.log('Step started');
                    break;

                  case 'reasoning-start':
                    // Reasoning started, no action needed
                    console.log('Reasoning started:', data.id);
                    break;

                  case 'reasoning-end':
                    // Reasoning ended, no action needed
                    console.log('Reasoning ended:', data.id);
                    break;

                  case 'text-start':
                    // Text generation started, store the ID
                    currentTextId = data.id;
                    console.log('Text generation started:', data.id);
                    break;

                  case 'text-delta':
                    // Text delta received, append to content
                    if (data.delta) {
                      content += data.delta;
                      onResponse(messageId, content, false);
                    }
                    break;

                  case 'text-end':
                    // Text generation ended
                    console.log('Text generation ended:', data.id);
                    break;

                  case 'finish-step':
                    // Step finished, no action needed
                    // console.log('Step finished');
                    break;

                  case 'finish':
                    // Stream finished
                    // console.log('Stream finished');
                    done = true;
                    break;

                  // Additional message types that might be present in the AI library
                  case 'tool-call':
                  case 'tool-input-available': //for now input calls should be handled the same way as tool calls
                    // Tool call initiated
                    console.log('Tool call initiated:', data);
                    isToolCallMode = true;
                    if (data.toolCallId && data.toolName && (data.args || data.input)) {
                      toolInvocations.push({
                        toolCallId: data.toolCallId,
                        toolName: data.toolName,
                        args: data.args || data.input,
                      });
                    }
                    break;

                  case 'tool-input-delta': //for now input calls should be handled the same way as tool calls
                  case 'tool-call-delta':
                    // Tool call delta (for streaming tool calls)
                    console.log('Tool call delta:', data);
                    break;

                  case 'tool-call-end':
                    // Tool call completed
                    console.log('Tool call completed:', data);
                    break;

                  case 'tool-result':
                    // Tool execution result
                    console.log('Tool result:', data);
                    break;

                  case 'error':
                    // Error occurred
                    console.error('Stream error:', data);
                    break;

                  case 'usage':
                    // Usage information
                    console.log('Usage info:', data);
                    break;

                  case 'model':
                    // Model information
                    console.log('Model info:', data);
                    break;

                  case 'stop':
                    // Stop signal
                    console.log('Stop signal received');
                    done = true;
                    break;

                  default:
                    // Unknown type, log for debugging
                    console.log('Unknown stream type:', data.type, data);
                    break;
                }
              } catch (error) {
                console.error('Error parsing stream data:', error, dataStr);
              }
            }
          }
        }

        if (readerDone) {
          done = true;
        }
      }

      // Check if we have content or if this was a tool call response
      if (content || toolInvocations.length > 0) {
        currentMessages.push({
          id: messageId,
          role: 'assistant',
          content: content,
          toolCalls: toolInvocations.length > 0 ? toolInvocations : undefined,
        });
      }

      // Handle tool call scenario if tools were provided
      if (tools.length > 0 && toolInvocations.length > 0) {
        console.log('Tool calls detected, executing tools...');

        const toolResults: Message[] = [];
        for (const toolInvocation of toolInvocations) {
          const tool = tools.find((t) => t.name === toolInvocation.toolName);
          if (tool && tool.execute) {
            try {
              const result = await tool.execute(toolInvocation.args);
              toolResults.push({
                id: Math.random().toString(36).substring(3),
                role: 'user',
                content: `Tool '${toolInvocation.toolName}' returned: ${JSON.stringify(result)}`,
              });
            } catch (error) {
              console.error(`Error executing tool ${toolInvocation.toolName}:`, error);
              toolResults.push({
                id: Math.random().toString(36).substring(3),
                role: 'user',
                content: `Tool '${toolInvocation.toolName}' failed with error: ${error}`,
              });
            }
          }
        }

        if (toolResults.length > 0) {
          currentMessages.push(...toolResults);
          // Continue the loop to handle the next response
          continue;
        }
      }

      // Since the new format doesn't seem to support tool calls in the same way,
      // we'll assume the stream is complete when we reach the end
      // If tools are provided and no content was generated, this might indicate a tool call
      if (tools.length > 0 && !content && !isToolCallMode) {
        // This might be a tool call scenario, but we need more information
        // For now, we'll just finish the stream
        console.log('No content generated, but tools provided - might be tool call scenario');
      }

      onResponse(messageId, content, true, toolInvocations);
      return;
    } catch (error) {
      console.error('Error in streamChatGPT:', error);
      onResponse(messageId, `Error: ${error instanceof Error ? error.message : String(error)}`, true, []);
      return;
    }
  }
}
