export interface ToolInvocation {
  toolName: string;
  args: Record<string, string>;
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    name: string;
    description: string;
    type: "string" | "number" | "boolean";
  }[];
  execute?: <T = Record<string, string | boolean | number>>(args: T) => Promise<any> | void;
}

export interface Message {
  id: string;
  role: string;
  content: string;
  toolInvocations?: ToolInvocation[];
}

export async function generateText(supabaseUrl: string, messages: Message[], tools: Tool[], token: string) {
  const response = await fetch(`${supabaseUrl}/functions/v1/llm`, {
    method: 'POST',
    body: JSON.stringify({ messages, tools }),
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  });

  return await response.json();
}

export type OnLLMResponse = (id: string, response: string, finished: boolean, toolInvocations?: ToolInvocation[]) => void;

export async function streamChatGPT(supabaseUrl: string, messages: Message[], tools: Tool[], onResponse: OnLLMResponse, token: string) {
  const messageId = Math.random().toString(36).substring(3);
  const response = await fetch(`${supabaseUrl}/functions/v1/llm`, {
    method: 'POST',
    body: JSON.stringify({ messages, tools, stream: true }),
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
  let toolInvocations: ToolInvocation[] = [];
  while (!done) {
    const { value } = await reader.read();

    if (value) {
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        const data = line.substring(3, line.length - 1);
        const command = line.substring(0, 1);
        // console.log("data: ", { line, data, command });

        if (command === '0') {
          content += data;
          // console.log("AI response:", content);

          //content \n\n should be real line break when message is displayed
          //content \"\" should be real double quote when message is displayed
          onResponse(messageId, content.replace(/\\n/g, '\n').replace(/\\+"|"\\+/g, '"'), false);
        } else if (command === 'd') {
          // console.log("AI usage:", JSON.parse(line.substring(2)));
          done = true;
          break;
        } else if (command === '9') {
          // console.log("tool call:", JSON.parse(line.substring(2)));
          // console.log("tools", tools);
          const toolInvocation = JSON.parse(line.substring(2));
          toolInvocations.push(toolInvocation);

          // Find the tool and execute it if it has an execute function
          const tool = tools.find(t => t.name === toolInvocation.toolName);
          // console.log("tool", tool);
          if (tool && tool.execute) {
            try {
              const result = await tool.execute(toolInvocation.args);
              const toolResult = { success: true, result: result }
              // Add the tool result as a message
              messages.push({
                id: Math.random().toString(36).substring(3),
                role: "function",
                content: JSON.stringify(toolResult),
                toolInvocations: [{
                  args: toolInvocation.args,
                  toolName: toolInvocation.toolName,
                }]
              });
            } catch (error) {
              console.error(`Error executing tool ${toolInvocation.toolName}:`, error);
            }
          }
        }
      }
    }
    // Wait for 5ms to avoid blocking the main thread
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  onResponse(messageId, content.replace(/\\n/g, '\n'), true, toolInvocations);
}
