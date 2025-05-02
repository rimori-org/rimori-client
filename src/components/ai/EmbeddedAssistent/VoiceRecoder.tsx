import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { FaMicrophone } from 'react-icons/fa6';
import { usePlugin } from '../../../components';

interface Props {
  iconSize?: string;
  className?: string;
  onVoiceRecorded: (message: string) => void;
}

export const VoiceRecorder = forwardRef(({ onVoiceRecorded, iconSize, className }: Props, ref) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { llm } = usePlugin();

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current);
      audioChunksRef.current = [];

      onVoiceRecorded(await llm.getTextFromVoice(audioBlob));
    };

    mediaRecorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  useImperativeHandle(ref, () => ({
    startRecording,
    stopRecording,
  }));

  return (
    <div className={className}>
      <button onClick={isRecording ? stopRecording : startRecording}>
        <FaMicrophone size={iconSize} className={"h-7 w-7 mr-2 " + (isRecording ? "text-red-600" : "")} />
      </button>
    </div>
  );
});
