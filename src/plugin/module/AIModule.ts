import { RimoriCommunicationHandler, RimoriInfo } from '../CommunicationHandler';
import { generateText, Message, OnLLMResponse, streamChatGPT } from '../../controller/AIController';
import { generateObject, ObjectRequest } from '../../controller/ObjectController';
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
   * @returns The generated text.
   */
  async getText(messages: Message[], tools?: Tool[]): Promise<string> {
    return generateText(this.backendUrl, messages, tools || [], this.token).then(
      ({ messages }) => messages[0].content[0].text,
    );
  }

  /**
   * Stream text generation from messages using AI.
   * @param messages The messages to generate text from.
   * @param onMessage Callback for each message chunk.
   * @param tools Optional tools to use for generation.
   */
  async getSteamedText(messages: Message[], onMessage: OnLLMResponse, tools?: Tool[]): Promise<void> {
    streamChatGPT(this.backendUrl, messages, tools || [], onMessage, this.token);
  }

  /**
   * Generate voice audio from text using AI.
   * @param text The text to convert to voice.
   * @param voice The voice to use (default: 'alloy').
   * @param speed The speed of the voice (default: 1).
   * @param language Optional language for the voice.
   * @returns The generated audio as a Blob.
   */
  async getVoice(text: string, voice = 'alloy', speed = 1, language?: string): Promise<Blob> {
    return getTTSResponse(this.backendUrl, { input: text, voice, speed, language }, this.token);
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
  async getObject<T = any>(request: ObjectRequest): Promise<T> {
    return generateObject<T>(this.backendUrl, request, this.token);
  }
}
