import React from "react";
import { Tool } from "../fromRimori/PluginTypes";
import { usePlugin } from "../providers/PluginProvider";
import { Message, ToolInvocation } from "../core/controller/AIController";

export function useChat(tools?: Tool[]) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const { ai } = usePlugin();

  const append = (appendMessages: Message[]) => {
    const allMessages = [...messages, ...appendMessages];
    setMessages(allMessages);
    ai.getSteamedText(allMessages, (id, message, finished: boolean, toolInvocations?: ToolInvocation[]) => {
      const lastMessage = messages[messages.length - 1];
      setIsLoading(!finished);

      if (lastMessage?.id === id) {
        lastMessage.content = message;
        setMessages([...messages, lastMessage]);
      } else {
        setMessages([...allMessages, { id, role: 'assistant', content: message, toolCalls: toolInvocations }]);
      }
    }, tools);
  };

  return { messages, append, isLoading, setMessages, lastMessage: messages[messages.length - 1] as Message | undefined };
}
