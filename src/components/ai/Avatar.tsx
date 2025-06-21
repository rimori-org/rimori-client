import { useEffect, useMemo, useState } from 'react';
import { VoiceRecorder } from './EmbeddedAssistent/VoiceRecoder';
import { MessageSender } from './EmbeddedAssistent/TTS/MessageSender';
import { CircleAudioAvatar } from './EmbeddedAssistent/CircleAudioAvatar';
import { Tool } from '../../core/controller/AIController';
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
  className?: string;
}

export function Avatar({
  avatarImageUrl,
  voiceId,
  agentTools,
  autoStartConversation,
  children,
  isDarkTheme = false,
  circleSize = "300px",
  className
}: Props) {
  const { ai, event } = usePlugin();
  const [agentReplying, setAgentReplying] = useState(false);
  const [isProcessingMessage, setIsProcessingMessage] = useState(false);
  const sender = useMemo(() => new MessageSender(ai.getVoice, voiceId), [voiceId]);
  const { messages, append, isLoading, lastMessage, setMessages } = useChat(agentTools);

  useEffect(() => {
    console.log("messages", messages);
  }, [messages]);

  useEffect(() => {
    if (!isLoading) setIsProcessingMessage(false);
  }, [isLoading]);

  useEffect(() => {
    sender.setOnLoudnessChange((value) => event.emit('self.avatar.triggerLoudness', { loudness: value }));
    sender.setOnEndOfSpeech(() => setAgentReplying(false));

    if (!autoStartConversation) return;

    setMessages(getFirstMessages(autoStartConversation));
    // append([{ role: 'user', content: autoStartConversation.userMessage }]);

    if (autoStartConversation.assistantMessage) {
      // console.log("autostartmessages", { autoStartConversation, isLoading });
      sender.handleNewText(autoStartConversation.assistantMessage, isLoading);
    } else if (autoStartConversation.userMessage) {
      append([{ role: 'user', content: autoStartConversation.userMessage, id: messages.length.toString() }]);
    }
  }, [autoStartConversation]);

  useEffect(() => {
    if (lastMessage?.role === 'assistant') {
      sender.handleNewText(lastMessage.content, isLoading);
      if (lastMessage.tool_calls) {
        console.log("unlocking mic",lastMessage)
        setAgentReplying(false);
        setIsProcessingMessage(false);
      }
    }
  }, [lastMessage, isLoading]);

  return (
    <div className={`pb-8 ${className}`}>
      <CircleAudioAvatar
        width={circleSize}
        className='mx-auto'
        imageUrl={avatarImageUrl}
        isDarkTheme={isDarkTheme} />
      {children}
      <VoiceRecorder
        iconSize='30'
        className='w-16 h-16 shadow-lg rounded-full bg-gray-400 dark:bg-gray-800'
        disabled={agentReplying}
        loading={isProcessingMessage}
        enablePushToTalk={true}
        onVoiceRecorded={(message) => {
          setAgentReplying(true);
          append([{ role: 'user', content: "Message(" + Math.floor((messages.length + 1) / 2) + "): " + message, id: messages.length.toString() }]);
        }}
        onRecordingStatusChange={(running) => !running && setIsProcessingMessage(true)} />
    </div>
  );
};
