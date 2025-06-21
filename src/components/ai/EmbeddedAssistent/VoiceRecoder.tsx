import { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { FaMicrophone, FaSpinner } from 'react-icons/fa6';
import { usePlugin } from '../../../components';

interface Props {
  iconSize?: string;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  enablePushToTalk?: boolean;
  onRecordingStatusChange: (running: boolean) => void;
  onVoiceRecorded: (message: string) => void;
}

export const VoiceRecorder = forwardRef(({ onVoiceRecorded, iconSize, className, disabled, loading, onRecordingStatusChange, enablePushToTalk = false }: Props, ref) => {
  const [isRecording, setIsRecording] = useState(false);
  const [internalIsProcessing, setInternalIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const { ai: llm } = usePlugin();

  // Ref for latest onVoiceRecorded callback
  const onVoiceRecordedRef = useRef(onVoiceRecorded);
  useEffect(() => {
    onVoiceRecordedRef.current = onVoiceRecorded;
  }, [onVoiceRecorded]);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaStreamRef.current = stream;
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      audioChunksRef.current.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current);
      audioChunksRef.current = [];


      setInternalIsProcessing(true);
      const text = await llm.getTextFromVoice(audioBlob);
      setInternalIsProcessing(false);
      onVoiceRecordedRef.current(text);
    };

    mediaRecorder.start();
    setIsRecording(true);
    onRecordingStatusChange(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      onRecordingStatusChange(false);
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };

  useImperativeHandle(ref, () => ({
    startRecording,
    stopRecording,
  }));

  // push to talk feature
  const spacePressedRef = useRef(false);

  useEffect(() => {
    if (!enablePushToTalk) return;

    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.code === 'Space' && !spacePressedRef.current) {
        spacePressedRef.current = true;
        await startRecording();
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' && spacePressedRef.current) {
        spacePressedRef.current = false;
        stopRecording();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enablePushToTalk]);

  return (
    <button className={"flex flex-row justify-center items-center rounded-full mx-auto pl-[6px] disabled:opacity-50 " + className}
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled || loading || internalIsProcessing}>
      {loading || internalIsProcessing ? <FaSpinner className="animate-spin mr-[6px]" /> :
        <FaMicrophone size={iconSize} className={(isRecording ? "text-red-600" : "")} />
      }
    </button>
  );
});
