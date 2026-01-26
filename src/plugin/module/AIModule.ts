import { RimoriCommunicationHandler, RimoriInfo } from '../CommunicationHandler';
import { generateText, Message, OnLLMResponse, streamChatGPT } from '../../controller/AIController';
import { generateObject, ObjectRequest, streamObject } from '../../controller/ObjectController';
import { getSTTResponse, getTTSResponse } from '../../controller/VoiceController';
import { Tool } from '../../fromRimori/PluginTypes';

/**
 * Controller for AI-related operations.
 * Provides access to text generation, voice synthesis, and object generation.
 */
export class AIModule {
  private communicationHandler: RimoriCommunicationHandler;
  private backendUrl: string;
  private token: string;

  constructor(communicationHandler: RimoriCommunicationHandler, info: RimoriInfo) {
    this.token = info.token;
    this.backendUrl = info.backendUrl;
    this.communicationHandler = communicationHandler;

    this.communicationHandler.onUpdate((updatedInfo) => {
      this.token = updatedInfo.token;
    });
  }

  /**
   * Generate text from messages using AI.
   * @param messages The messages to generate text from.
   * @param tools Optional tools to use for generation.
   * @param cache Whether to cache the result (default: false).
   * @returns The generated text.
   */
  async getText(messages: Message[], tools?: Tool[], cache = false): Promise<string> {
    return generateText(this.backendUrl, messages, tools || [], this.token, cache).then(
      ({ messages }) => messages[0].content[0].text,
    );
  }

  /**
   * Stream text generation from messages using AI.
   * @param messages The messages to generate text from.
   * @param onMessage Callback for each message chunk.
   * @param tools Optional tools to use for generation.
   * @param cache Whether to cache the result (default: false).
   */
  async getSteamedText(messages: Message[], onMessage: OnLLMResponse, tools?: Tool[], cache = false): Promise<void> {
    streamChatGPT(this.backendUrl, messages, tools || [], onMessage, this.token, cache);
  }

  /**
   * Generate voice audio from text using AI.
   * @param text The text to convert to voice.
   * @param voice The voice to use (default: 'alloy').
   * @param speed The speed of the voice (default: 1).
   * @param language Optional language for the voice.
   * @param cache Whether to cache the result (default: false).
   * @returns The generated audio as a Blob.
   */
  async getVoice(text: string, voice = 'alloy', speed = 1, language?: string, cache = false): Promise<Blob> {
    return getTTSResponse(this.backendUrl, { input: text, voice, speed, language, cache }, this.token);
  }

  /**
   * Convert voice audio to text using AI.
   * @param file The audio file to convert.
   * @returns The transcribed text.
   */
  async getTextFromVoice(file: Blob): Promise<string> {
    return getSTTResponse(this.backendUrl, file, this.token);
  }

  /**
   * Generate a structured object from a request using AI.
   * @param request The object generation request.
   * @returns The generated object.
   */
  async getObject<T = any>(request: ObjectRequest, cache = false): Promise<T> {
    return generateObject<T>(this.backendUrl, request, this.token, cache);
  }

  /**
   * Generate a streamed structured object from a request using AI.
   * @param request The object generation request.
   * @param onResult Callback for each result chunk.
   * @param cache Whether to cache the result (default: false).
   */
  async getStreamedObject<T = any>(
    request: ObjectRequest,
    onResult: (result: T, isLoading: boolean) => void,
    cache = false,
  ): Promise<void> {
    return streamObject<T>(this.backendUrl, request, onResult, this.token, cache);
  }
}
