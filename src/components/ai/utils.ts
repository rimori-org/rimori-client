export interface FirstMessages {
  instructions?: string;
  userMessage?: string;
  assistantMessage?: string;
}

export function getFirstMessages(instructions: FirstMessages): any[] {
  const messages = [];

  if (instructions.instructions) {
      messages.push({ id: '1', role: 'system', content: instructions.instructions });
  }
  if (instructions.userMessage) {
      messages.push({ id: '2', role: 'user', content: instructions.userMessage });
  }
  if (instructions.assistantMessage) {
      messages.push({ id: '3', role: 'assistant', content: instructions.assistantMessage });
  }

  return messages;
}