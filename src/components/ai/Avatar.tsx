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
    title?: string;
    voiceId: any;
    avatarImageUrl: string;
    agentTools: Tool[];
    autoStartConversation?: FirstMessages;
}

export function Avatar({ avatarImageUrl, voiceId, title, agentTools, autoStartConversation }: Props) {
    const { llm, event } = usePlugin();
    const sender = useMemo(() => new MessageSender(llm.getVoice, voiceId), []);
    const { messages, append, isLoading, lastMessage, setMessages } = useChat(agentTools);

    useEffect(() => {
        console.log("messages", messages);
    }, [messages]);

    useEffect(() => {
        sender.setOnLoudnessChange((value: number) => event.emit('self.avatar.triggerLoudness', value));

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
            {title && <p className="text-center mt-5 w-3/4 mx-auto rounded-lg dark:text-gray-100">{title}</p>}
            <CircleAudioAvatar imageUrl={avatarImageUrl} width={"250px"} className='mx-auto' />
            <div className='w-16 h-16 flex text-4xl shadow-lg flex-row justify-center items-center rounded-full mx-auto bg-gray-400 dark:bg-gray-800'>
                <VoiceRecorder className='w-7' iconSize='300' onVoiceRecorded={(message) => {
                    append([{ role: 'user', content: "Message(" + Math.floor((messages.length + 1) / 2) + "): " + message, id: messages.length.toString() }]);
                }} />
            </div>
        </div>
    );
};
