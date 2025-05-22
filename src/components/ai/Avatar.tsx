import { Tool } from '../../core';
import { useEffect, useMemo } from 'react';
import { VoiceRecorder } from './EmbeddedAssistent/VoiceRecoder';
import { MessageSender } from './EmbeddedAssistent/TTS/MessageSender';
import { CircleAudioAvatar } from './EmbeddedAssistent/CircleAudioAvatar';
import { useChat } from '../../hooks/UseChatHook';
import { usePlugin } from '../../components';
import { getFirstMessages } from './utils';
import { FirstMessages } from './utils';

interface Props {
  voiceId: any;
  agentTools: Tool[];
  avatarImageUrl: string;
  circleSize?: string;
  isDarkTheme?: boolean;
  children?: React.ReactNode;
  autoStartConversation?: FirstMessages;
}

export function Avatar({ avatarImageUrl, voiceId, agentTools, autoStartConversation, children, isDarkTheme = false, circleSize = "300px" }: Props) {
  const { llm, event } = usePlugin();
  const sender = useMemo(() => new MessageSender(llm.getVoice, voiceId), []);
  const { messages, append, isLoading, lastMessage, setMessages } = useChat(agentTools);

  useEffect(() => {
    console.log("messages", messages);
  }, [messages]);

  useEffect(() => {
    sender.setOnLoudnessChange((value: number) => event.emit('self.avatar.triggerLoudness', { loudness: value }));

    if (!autoStartConversation) return;

    setMessages(getFirstMessages(autoStartConversation));
    // append([{ role: 'user', content: autoStartConversation.userMessage }]);

    if (autoStartConversation.assistantMessage) {
      // console.log("autostartmessages", { autoStartConversation, isLoading });
      sender.handleNewText(autoStartConversation.assistantMessage, isLoading);
    } else if (autoStartConversation.userMessage) {
      append([{ role: 'user', content: autoStartConversation.userMessage, id: messages.length.toString() }]);
    }
  }, []);

  useEffect(() => {
    if (lastMessage?.role === 'assistant') {
      sender.handleNewText(lastMessage.content, isLoading);
    }
  }, [lastMessage, isLoading]);

  return (
    <div className='pb-8'>
      <CircleAudioAvatar imageUrl={avatarImageUrl} width={circleSize} className='mx-auto' isDarkTheme={isDarkTheme} />
      {children}
      <VoiceRecorder className='' iconSize='300' onVoiceRecorded={(message) => {
        append([{ role: 'user', content: "Message(" + Math.floor((messages.length + 1) / 2) + "): " + message, id: messages.length.toString() }]);
      }} />
    </div>
  );
};
