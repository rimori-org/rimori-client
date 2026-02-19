export class ChunkedAudioPlayer {
  private audioContext!: AudioContext;
  private chunkQueue: ArrayBuffer[] = [];
  private isPlaying = false;
  private analyser!: AnalyserNode;
  private dataArray!: Uint8Array<ArrayBuffer>;
  private shouldMonitorLoudness = true;
  private isMonitoring = false;
  private handle = 0;
  private volume = 1.0;
  private loudnessCallback: (value: number) => void = () => {};
  private currentIndex = 0;
  private startedPlaying = false;
  private onEndOfSpeech: () => void = () => {};
  private readonly backgroundNoiseLevel = 30; // Background noise level that should be treated as baseline (0)

  constructor() {
    this.init();
  }

  private init(): void {
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256; // Set the FFT size (smaller values provide faster updates, larger ones give better resolution)
    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength); // Array to hold frequency data
  }

  public setOnLoudnessChange(callback: (value: number) => void) {
    this.loudnessCallback = callback;
  }

  public setVolume(volume: number) {
    this.volume = volume;
  }

  public async addChunk(chunk: ArrayBuffer, position: number): Promise<void> {
    console.log('Adding chunk', position, chunk);
    this.chunkQueue[position] = chunk;
    // console.log("received chunk", {
    //     chunkQueue: this.chunkQueue.length,
    //     isPlaying: this.isPlaying,
    // })

    if (position === 0 && !this.startedPlaying) {
      this.startedPlaying = true;
      this.playChunks();
    }
  }

  private playChunks(): void {
    // console.log({ isPlaying: this.isPlaying });
    if (this.isPlaying) return;
    if (!this.chunkQueue[this.currentIndex]) {
      // wait until the correct chunk arrives
      setTimeout(() => this.playChunks(), 10);
    }
    this.isPlaying = true;

    this.playChunk(this.chunkQueue[this.currentIndex]).then(() => {
      this.isPlaying = false;
      this.currentIndex++;
      if (this.chunkQueue[this.currentIndex]) {
        this.shouldMonitorLoudness = true;
        this.playChunks();
      } else {
        // console.log('Playback finished', { currentIndex: this.currentIndex, chunkQueue: this.chunkQueue });
        setTimeout(() => {
          // console.log('Check again if really playback finished', { currentIndex: this.currentIndex, chunkQueue: this.chunkQueue });
          if (this.chunkQueue.length > this.currentIndex) {
            this.playChunks();
          } else {
            this.startedPlaying = false;
            this.shouldMonitorLoudness = false;
          }
        }, 1000);
      }
    });
  }

  public stopPlayback(): void {
    // console.log('Stopping playback');
    // Implement logic to stop the current playback
    this.isPlaying = false;
    this.chunkQueue = [];
    this.startedPlaying = false;
    this.shouldMonitorLoudness = false;
    cancelAnimationFrame(this.handle);
  }

  public cleanup(): void {
    // Stop playback first
    this.stopPlayback();
    // Close AudioContext to free resources
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch((e) => {
        console.warn('Error closing AudioContext:', e);
      });
    }
  }

  private playChunk(chunk: ArrayBuffer): Promise<void> {
    // console.log({queue: this.chunkQueue})
    if (!chunk) {
      return Promise.resolve();
    }

    // console.log('Playing chunk', chunk);
    return new Promise((resolve) => {
      const source = this.audioContext.createBufferSource();
      this.audioContext.decodeAudioData(chunk.slice(0)).then((audioBuffer) => {
        source.buffer = audioBuffer;

        // Create a GainNode for volume control
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = this.volume;

        // Connect the source to the GainNode, then to the analyser node, then to the destination (speakers)
        source.connect(gainNode);
        gainNode.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);

        source.start(0);
        // console.log('Playing chunk', this.currentIndex);
        gainNode.gain.value = this.volume;
        source.onended = () => {
          // console.log('Chunk ended');
          resolve();
        };

        // Start monitoring loudness only once
        if (!this.isMonitoring) {
          this.isMonitoring = true;
          this.shouldMonitorLoudness = true;
          this.monitorLoudness();
        }
      });
    });
  }

  async playAgain(): Promise<void> {
    console.log('Playing again');
    if (this.chunkQueue.length > 0 && !this.isPlaying) {
      this.playChunks();
    }
  }

  private monitorLoudness(): void {
    // Stop monitoring when the flag is false
    if (!this.shouldMonitorLoudness) {
      // console.log('Loudness monitoring stopped.');
      cancelAnimationFrame(this.handle);
      this.loudnessCallback(0);
      this.onEndOfSpeech();
      return;
    }

    // Get the time domain data from the analyser (this is a snapshot of the waveform)
    this.analyser.getByteTimeDomainData(this.dataArray);

    // Calculate the RMS (root mean square) of the waveform values to get the perceived loudness
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const value = this.dataArray[i] / 128.0 - 1.0; // Normalize between -1 and 1
      sum += value * value;
    }

    const rms = Math.sqrt(sum / this.dataArray.length);

    // Handle the case where RMS is 0 to avoid log10(0)
    if (rms === 0) {
      // console.log('Current loudness: Silent');
    } else {
      let loudnessInDb = 20 * Math.log10(rms); // Convert to dB
      // console.log('Current loudness:' + loudnessInDb);
      const minDb = -57;
      const maxDb = -15;

      if (loudnessInDb < minDb) {
        loudnessInDb = minDb;
      }
      if (loudnessInDb > maxDb) {
        loudnessInDb = maxDb;
      }

      let loudnessScale = ((loudnessInDb - minDb) / (maxDb - minDb)) * 100;

      // Adjust loudness: shift zero level up by background noise amount
      // Values below background noise level are set to 0
      // Values above are remapped to 0-100 scale
      if (loudnessScale < this.backgroundNoiseLevel) {
        loudnessScale = 0;
      } else {
        // Remap from [backgroundNoiseLevel, 100] to [0, 100]
        loudnessScale = ((loudnessScale - this.backgroundNoiseLevel) / (100 - this.backgroundNoiseLevel)) * 100;
      }

      this.loudnessCallback(Math.round(loudnessScale));
    }

    // Call this method again at regular intervals if you want continuous loudness monitoring
    this.handle = requestAnimationFrame(() => this.monitorLoudness());
  }
  public reset() {
    // console.log('Resetting player');
    this.stopPlayback();
    this.currentIndex = 0;
    this.shouldMonitorLoudness = true;
    //reset to the beginning when the class gets initialized
    this.isMonitoring = false;
    this.isPlaying = false;
    this.init();
  }

  public setOnEndOfSpeech(callback: () => void) {
    this.onEndOfSpeech = callback;
  }
}
