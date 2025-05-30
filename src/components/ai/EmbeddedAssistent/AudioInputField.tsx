import React, { useState } from 'react';
import { VoiceRecorder } from './VoiceRecoder';
import { BiSolidRightArrow } from "react-icons/bi";
import { HiMiniSpeakerXMark, HiMiniSpeakerWave } from "react-icons/hi2";

interface AudioInputFieldProps {
    onSubmit: (text: string) => void;
    onAudioControl?: (voice: boolean) => void;
    blockSubmission?: boolean;
}

export function AudioInputField({ onSubmit, onAudioControl, blockSubmission = false }: AudioInputFieldProps) {
    const [text, setText] = useState('');
    const [audioEnabled, setAudioEnabled] = useState(true);

    const handleSubmit = (manualText?: string) => {
        if (blockSubmission) return;
        const sendableText = manualText || text;
        if (sendableText.trim()) {
            onSubmit(sendableText);
            setTimeout(() => {
                setText('');
            }, 100);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (blockSubmission) return;
        if (e.key === 'Enter' && e.ctrlKey) {
            setText(text + '\n');
        } else if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    return (
        <div className="flex items-center bg-gray-600 pt-2 pb-2 p-2">
            {onAudioControl && <button
                onClick={() => {
                    onAudioControl(!audioEnabled);
                    setAudioEnabled(!audioEnabled);
                }}
                className="cursor-default">
                {audioEnabled ? <HiMiniSpeakerWave className='w-9 h-9 cursor-pointer' /> : <HiMiniSpeakerXMark className='w-9 h-9 cursor-pointer' />}
            </button>}
            <VoiceRecorder onRecordingStatusChange={() => {}} onVoiceRecorded={(m: string) => {
                console.log('onVoiceRecorded', m);
                handleSubmit(m);
            }}
            />
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 border-none rounded-lg p-2 text-gray-800 focus::outline-none"
                placeholder='Type a message...'
                disabled={blockSubmission}
            />
            <button onClick={() => handleSubmit()} className="cursor-default" disabled={blockSubmission}>
                <BiSolidRightArrow className='w-9 h-10 cursor-pointer' />
            </button>
        </div>
    );
};
