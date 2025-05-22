import React, { useEffect, useMemo } from 'react';
import { CircleAudioAvatar } from './EmbeddedAssistent/CircleAudioAvatar';
import { AudioInputField } from './EmbeddedAssistent/AudioInputField';
import { MessageSender } from './EmbeddedAssistent/TTS/MessageSender';
import Markdown from 'react-markdown';
import { useChat } from '../../hooks/UseChatHook';
import { usePlugin } from '../../components';
import { FirstMessages, getFirstMessages } from './utils';

interface Props {
    voiceId: any;
    avatarImageUrl: string;
    onComplete: (result: any) => void;
    autoStartConversation?: FirstMessages;
}

export function AssistantChat({ avatarImageUrl, voiceId, onComplete, autoStartConversation }: Props) {
    const [oralCommunication, setOralCommunication] = React.useState(true);
    const { llm, event } = usePlugin();
    const sender = useMemo(() => new MessageSender(llm.getVoice, voiceId), []);
    const { messages, append, isLoading, setMessages } = useChat();

    const lastAssistantMessage = [...messages].filter((m) => m.role === 'assistant').pop()?.content;

    useEffect(() => {
        sender.setOnLoudnessChange((value: number) => event.emit('self.avatar.triggerLoudness', { loudness: value }));

        if (!autoStartConversation) {
            return;
        }

        setMessages(getFirstMessages(autoStartConversation));
        // append([{ role: 'user', content: autoStartConversation.userMessage }]);

        if (autoStartConversation.assistantMessage) {
            // console.log("autostartmessages", { autoStartConversation, isLoading });
            sender.handleNewText(autoStartConversation.assistantMessage, isLoading);
        }
    }, []);

    useEffect(() => {
        let message = lastAssistantMessage;
        if (message !== messages[messages.length - 1]?.content) {
            message = undefined;
        }
        sender.handleNewText(message, isLoading);
    }, [messages, isLoading]);

    const lastMessage = messages[messages.length - 1];

    useEffect(() => {
        console.log("lastMessage", lastMessage);
        const toolInvocations = lastMessage?.toolInvocations;
        if (toolInvocations && toolInvocations.length > 0) {
            console.log("toolInvocations", toolInvocations);
            onComplete(toolInvocations[0].args);
        }
    }, [lastMessage]);

    if (lastMessage?.toolInvocations && lastMessage.toolInvocations.length > 0) {
        console.log("lastMessage test2", lastMessage);
        const args = lastMessage.toolInvocations[0].args;

        const success = args.explanationUnderstood === "TRUE" || args.studentKnowsTopic === "TRUE";

        return <div className="px-5 pt-5 overflow-y-auto text-center" style={{ height: "478px" }}>
            <h1 className='text-center mt-5 mb-5'>
                {success ? "Great job!" : "You failed"}
            </h1>
            <p>{args.improvementHints}</p>
        </div>
    }

    return (
        <div>
            {oralCommunication && <CircleAudioAvatar imageUrl={avatarImageUrl} className='mx-auto my-10' />}
            <div className="w-full">
                {lastAssistantMessage && <div className="px-5 pt-5 overflow-y-auto remirror-theme" style={{ height: "4k78px" }}>
                    <Markdown>{lastAssistantMessage}</Markdown>
                </div>}
            </div>
            <AudioInputField
                blockSubmission={isLoading}
                onSubmit={message => {
                    append([{ role: 'user', content: message, id: messages.length.toString() }]);
                }}
                onAudioControl={voice => {
                    setOralCommunication(voice);
                    sender.setVolume(voice ? 1 : 0);
                }} />
        </div>
    );
};



