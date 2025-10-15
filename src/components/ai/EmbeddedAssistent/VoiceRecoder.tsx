import { useRimori } from '../../../components';
import { FaMicrophone, FaSpinner } from 'react-icons/fa6';
import { AudioController } from '../../../plugin/AudioController';
import { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';

interface Props {
  iconSize?: string;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  enablePushToTalk?: boolean;
  onRecordingStatusChange: (running: boolean) => void;
  onVoiceRecorded: (message: string) => void;
}

export const VoiceRecorder = forwardRef(
  (
    {
      onVoiceRecorded,
      iconSize,
      className,
      disabled,
      loading,
      onRecordingStatusChange,
      enablePushToTalk = false,
    }: Props,
    ref,
  ) => {
    const [isRecording, setIsRecording] = useState(false);
    const [internalIsProcessing, setInternalIsProcessing] = useState(false);
    const audioControllerRef = useRef<AudioController | null>(null);
    const { ai, plugin } = useRimori();

    // Ref for latest onVoiceRecorded callback
    const onVoiceRecordedRef = useRef(onVoiceRecorded);
    useEffect(() => {
      onVoiceRecordedRef.current = onVoiceRecorded;
    }, [onVoiceRecorded]);

    const startRecording = async () => {
      try {
        if (!audioControllerRef.current) {
          audioControllerRef.current = new AudioController(plugin.pluginId);
        }

        await audioControllerRef.current.startRecording();
        setIsRecording(true);
        onRecordingStatusChange(true);
      } catch (error) {
        console.error('Failed to start recording:', error);
        // Handle permission denied or other errors
      }
    };

    const stopRecording = async () => {
      try {
        if (audioControllerRef.current && isRecording) {
          const audioResult = await audioControllerRef.current.stopRecording();
          // console.log("audioResult: ", audioResult);

          setInternalIsProcessing(true);

          // Play the recorded audio from the Blob
          // const blobUrl = URL.createObjectURL(audioResult.recording);
          // const audioRef = new Audio(blobUrl);
          // audioRef.onended = () => URL.revokeObjectURL(blobUrl);
          // audioRef.play().catch((e) => console.error('Playback error:', e));

          // console.log("audioBlob: ", audioResult.recording);
          const text = await ai.getTextFromVoice(audioResult.recording);
          // console.log("stt result", text);
          // throw new Error("test");
          setInternalIsProcessing(false);
          onVoiceRecordedRef.current(text);
        }
      } catch (error) {
        console.error('Failed to stop recording:', error);
      } finally {
        setIsRecording(false);
        onRecordingStatusChange(false);
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
      <button
        className={'flex flex-row justify-center items-center rounded-full mx-auto disabled:opacity-50 ' + className}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || loading || internalIsProcessing}
      >
        {loading || internalIsProcessing ? (
          <FaSpinner className="animate-spin" />
        ) : (
          <FaMicrophone size={iconSize} className={isRecording ? 'text-red-600' : ''} />
        )}
      </button>
    );
  },
);
