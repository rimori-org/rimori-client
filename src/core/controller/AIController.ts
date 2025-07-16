import { Tool } from "../../fromRimori/PluginTypes";

export interface ToolInvocation {
  tool_call_id: string;
  tool_name: string;
  args: Record<string, string>;
}

export interface Message {
  id?: string;
  role: "user" | "assistant" | "system"
  content: string;
  tool_calls?: ToolInvocation[];
  tool_call_id?: string;
}

export async function generateText(backendUrl: string, messages: Message[], tools: Tool[], token: string) {
  const response = await fetch(`${backendUrl}/ai/llm`, {
    method: 'POST',
    body: JSON.stringify({ messages, tools }),
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  });

  return await response.json();
}

export type OnLLMResponse = (id: string, response: string, finished: boolean, toolInvocations?: { toolName: string, args: any }[]) => void;

export async function streamChatGPT(backendUrl: string, messages: Message[], tools: Tool[], onResponse: OnLLMResponse, token: string) {
  const messageId = Math.random().toString(36).substring(3);
  let currentMessages: Message[] = [...messages];

  while (true) {
    const messagesForApi = currentMessages.map(({ id, ...rest }) => rest);

    const response = await fetch(`${backendUrl}/ai/llm`, {
      method: 'POST',
      body: JSON.stringify({ messages: messagesForApi, tools, stream: true }),
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });

    if (!response.body) {
      console.error('No response body.');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let content = "";
    let done = false;
    let toolInvocations: { toolCallId: string, toolName: string, args: any }[] = [];
    let finishReason = "";

    while (!done) {
      const { value, done: readerDone } = await reader.read();

      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          const command = line.substring(0, 1);

          if (command === '0') {
            const data = line.substring(3, line.length - 1);
            content += data;
            onResponse(messageId, content.replace(/\\n/g, '\n').replace(/\\+"/g, '"'), false);
          } else if (command === 'd' || command === 'e') {
            const eventData = JSON.parse(line.substring(2));
            finishReason = eventData.finishReason;
            done = true;
            break;
          } else if (command === '9') {
            const toolInvocation = JSON.parse(line.substring(2));
            toolInvocations.push(toolInvocation);
          }
        }
      }

      if (readerDone) {
        done = true;
      }
    }

    if (content || toolInvocations.length > 0) {
      currentMessages.push({
        id: messageId,
        role: "assistant",
        content: content,
        tool_calls: toolInvocations.length > 0 ? toolInvocations.map(t => ({
          tool_call_id: t.toolCallId,
          tool_name: t.toolName,
          args: t.args
        })) : undefined,
      });
    }

    if (finishReason !== 'tool-calls') {
      onResponse(messageId, content.replace(/\\n/g, '\n'), true, toolInvocations.map(t => ({ toolName: t.toolName, args: t.args })));
      return;
    }

    const toolResults: Message[] = [];
    for (const toolInvocation of toolInvocations) {
      const tool = tools.find(t => t.name === toolInvocation.toolName);
      if (tool && tool.execute) {
        try {
          const result = await tool.execute(toolInvocation.args);
          toolResults.push({
            id: Math.random().toString(36).substring(3),
            role: "user",
            content: `Tool '${toolInvocation.toolName}' returned: ${JSON.stringify(result)}`,
          });
        } catch (error) {
          console.error(`Error executing tool ${toolInvocation.toolName}:`, error);
          toolResults.push({
            id: Math.random().toString(36).substring(3),
            role: "user",
            content: `Tool '${toolInvocation.toolName}' failed with error: ${error}`,
          });
        }
      }
    }
    currentMessages.push(...toolResults);
  }
}
