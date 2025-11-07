import { EventBus } from '../../fromRimori/EventBus';

/**
 * AudioController is a class that provides methods to record audio. It is a wrapper around the Capacitor Voice Recorder plugin. For more information, see https://github.com/tchvu3/capacitor-voice-recorder.
 *
 * @example
 * const audioController = new AudioController();
 * await audioController.startRecording();
 */
export class AudioController {
  private pluginId: string;

  constructor(pluginId: string) {
    this.pluginId = pluginId;
  }

  /**
   * Start the recording.
   *
   * @example
   * const audioController = new AudioController();
   * await audioController.startRecording();
   * @returns void
   */
  public async startRecording(): Promise<void> {
    EventBus.emit(this.pluginId, 'global.microphone.triggerStartRecording');
  }

  /**
   * Stop the recording and return the audio data.
   * @returns The audio data.
   *
   * @example
   * const audioRef = new Audio(`data:${mimeType};base64,${base64Sound}`)
   * audioRef.oncanplaythrough = () => audioRef.play()
   * audioRef.load()
   */
  public async stopRecording(): Promise<{ recording: Blob; msDuration: number; mimeType: string }> {
    const result = await EventBus.request<{ recording: Blob; msDuration: number; mimeType: string }>(
      this.pluginId,
      'global.microphone.triggerStopRecording',
    );

    return result.data;
  }

  public async pauseRecording(): Promise<boolean> {
    const result = await EventBus.request<boolean>(this.pluginId, 'global.microphone.triggerPauseRecording');
    return result.data;
  }

  public async resumeRecording(): Promise<boolean> {
    const result = await EventBus.request<boolean>(this.pluginId, 'global.microphone.triggerResumeRecording');
    return result.data;
  }

  public async getCurrentStatus(): Promise<'RECORDING' | 'PAUSED' | 'NONE'> {
    const result = await EventBus.request<'RECORDING' | 'PAUSED' | 'NONE'>(
      this.pluginId,
      'global.microphone.triggerGetCurrentStatus',
    );
    return result.data;
  }
}
