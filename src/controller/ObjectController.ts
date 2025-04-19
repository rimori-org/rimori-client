import { env } from "../utils/constants";

type PrimitiveType = 'string' | 'number' | 'boolean';

// This is the type that can appear in the `type` property
type ObjectToolParameterType =
    | PrimitiveType
    | { [key: string]: ObjectToolParameter }  // for nested objects
    | [{ [key: string]: ObjectToolParameter }];  // for arrays of objects (notice the tuple type)

interface ObjectToolParameter {
    type: ObjectToolParameterType;
    description?: string;
    enum?: string[];
}

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

export async function generateObject(request: ObjectRequest, token: string) {
    return await fetch(`${env.SUPABASE_URL}/functions/v1/llm-object`, {
        method: 'POST',
        body: JSON.stringify({
            stream: false,
            tool: request.tool,
            behaviour: request.behaviour,
            instructions: request.instructions,
        }),
        headers: { 'Authorization': `Bearer ${token}` }
    }).then(response => response.json());
}

// TODO adjust stream to work with object
export type OnLLMResponse = (id: string, response: string, finished: boolean, toolInvocations?: any[]) => void;

export async function streamObject(request: ObjectRequest, onResponse: OnLLMResponse, token: string) {
    const messageId = Math.random().toString(36).substring(3);
    const response = await fetch(`${env.SUPABASE_URL}/functions/v1/llm-object`, {
        method: 'POST',
        body: JSON.stringify({
            stream: true,
            tools: request.tool,
            systemInstructions: request.behaviour,
            secondaryInstructions: request.instructions,
        }),
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.body) {
        console.error('No response body.');
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let content = "";
    let done = false;
    let toolInvocations: any[] = [];
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
                    onResponse(messageId, content.replace(/\\n/g, '\n'), false);
                } else if (command === 'd') {
                    // console.log("AI usage:", JSON.parse(line.substring(2)));
                    done = true;
                    break;
                } else if (command === '9') {
                    // console.log("tool call:", JSON.parse(line.substring(2)));
                    // console.log("tools", tools);
                    toolInvocations.push(JSON.parse(line.substring(2)));
                }
            }
        }
    }
    onResponse(messageId, content.replace(/\\n/g, '\n'), true, toolInvocations);
}
