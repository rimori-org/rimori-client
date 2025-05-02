import { ChunkedAudioPlayer } from './Player';

type VoiceBackend = (text: string, voice?: string, speed?: number) => Promise<Blob>;

export class MessageSender {
    private player = new ChunkedAudioPlayer();
    private fetchedSentences = new Set<string>();
    private lastLoading = false;
    private voice: string;
    private model: string;
    private voiceBackend: VoiceBackend;

    constructor(voiceBackend: VoiceBackend, voice: string = 'alloy', model = 'openai') {
        this.voiceBackend = voiceBackend;
        this.voice = voice;
        this.model = model;
    }

    private getCompletedSentences(currentText: string, isLoading: boolean): string[] {
        // Split the text based on the following characters: .,?!
        // Only split on : when followed by a space
        const pattern = /(.+?[,.?!]|.+?:\s+|.+?\n+)/g;
        const result: string[] = [];
        let match;
        while ((match = pattern.exec(currentText)) !== null) {
            const sentence = match[0].trim();
            if (sentence.length > 0) {
                result.push(sentence);
            }
        }
        if (!isLoading) {
            const lastFullSentence = result[result.length - 1];
            const leftoverIndex = currentText.lastIndexOf(lastFullSentence) + lastFullSentence.length;
            if (leftoverIndex < currentText.length) {
                result.push(currentText.slice(leftoverIndex).trim());
            }
        }
        return result;
    }

    public async handleNewText(currentText: string | undefined, isLoading: boolean) {
        if (!this.lastLoading && isLoading) {
            this.reset();
        }
        this.lastLoading = isLoading;

        if (!currentText) {
            return;
        }

        const sentences = this.getCompletedSentences(currentText, isLoading);

        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            if (!this.fetchedSentences.has(sentence)) {
                this.fetchedSentences.add(sentence);
                const audioData = await this.generateSpeech(sentence);
                await this.player.addChunk(audioData, i);
            }
        }
    }

    private async generateSpeech(sentence: string): Promise<ArrayBuffer> {
        const blob = await this.voiceBackend(sentence, this.voice, 1.0);
        return await blob.arrayBuffer();
    }

    public play() {
        this.player.playAgain();
    }

    public stop() {
        this.player.stopPlayback();
    }

    private reset() {
        this.stop();
        this.fetchedSentences.clear();
        this.player.reset();
    }

    public setVolume(volume: number) {
        this.player.setVolume(volume);
    }

    public setOnLoudnessChange(callback: (value: number) => void) {
        this.player.setOnLoudnessChange((loudness) => {
            callback(loudness);
        });
    }
}