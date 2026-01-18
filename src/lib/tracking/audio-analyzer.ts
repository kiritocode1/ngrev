/**
 * Audio Analyzer for Music-Reactive Video Tracking
 * 
 * Uses Web Audio API to extract:
 * - Beat detection (kick drums, bass hits)
 * - Bass levels (low frequency energy)
 * - Mid/High frequency levels
 * - Overall audio energy
 */

export interface AudioData {
    /** Overall audio energy (0-1) */
    energy: number;
    /** Bass frequency energy (0-1) - good for big visual beats */
    bass: number;
    /** Mid frequency energy (0-1) */
    mid: number;
    /** High frequency energy (0-1) */
    high: number;
    /** Beat detected this frame */
    beatDetected: boolean;
    /** Beat intensity for smoother animations (0-1) */
    beatIntensity: number;
    /** Raw frequency data for custom visualizations */
    frequencyData: Uint8Array;
    /** Time since last beat (ms) */
    timeSinceLastBeat: number;
}

export interface AudioAnalyzerConfig {
    /** FFT size for frequency analysis (power of 2, 32-32768) */
    fftSize: number;
    /** Smoothing time constant (0-1, higher = smoother) */
    smoothingTimeConstant: number;
    /** Beat detection sensitivity (0-1, lower = more sensitive) */
    beatSensitivity: number;
    /** Minimum time between detected beats (ms) */
    minBeatInterval: number;
}

const DEFAULT_CONFIG: AudioAnalyzerConfig = {
    fftSize: 256,
    smoothingTimeConstant: 0.6,
    beatSensitivity: 0.15,
    minBeatInterval: 100,
};

export class AudioAnalyzer {
    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private source: MediaElementAudioSourceNode | null = null;

    private frequencyData: Uint8Array = new Uint8Array(0);
    private timeData: Uint8Array = new Uint8Array(0);

    private config: AudioAnalyzerConfig;

    // Beat detection state
    private previousEnergy = 0;
    private energyHistory: number[] = [];
    private lastBeatTime = 0;
    private beatIntensity = 0;

    // Audio data output
    private currentData: AudioData = {
        energy: 0,
        bass: 0,
        mid: 0,
        high: 0,
        beatDetected: false,
        beatIntensity: 0,
        frequencyData: new Uint8Array(0),
        timeSinceLastBeat: 0,
    };

    constructor(config: Partial<AudioAnalyzerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Connect to a video element's audio
     */
    async connect(video: HTMLVideoElement): Promise<void> {
        try {
            // Create audio context if not exists
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            }

            // Resume if suspended (browser autoplay policy)
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.config.fftSize;
            this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;

            // Create media element source
            // Note: Can only create one source per video element
            try {
                this.source = this.audioContext.createMediaElementSource(video);
            } catch (e) {
                // Source might already exist if video was connected before
                console.warn('Audio source already connected, reusing context');
                return;
            }

            // Connect source -> analyser -> destination (speakers)
            this.source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);

            // Initialize data arrays
            const bufferLength = this.analyser.frequencyBinCount;
            this.frequencyData = new Uint8Array(bufferLength);
            this.timeData = new Uint8Array(bufferLength);

            console.log('🎵 Audio analyzer connected');
        } catch (error) {
            console.error('Failed to connect audio analyzer:', error);
            throw error;
        }
    }

    /**
     * Disconnect from audio source
     */
    disconnect(): void {
        if (this.source) {
            try {
                this.source.disconnect();
            } catch (e) {
                // Already disconnected
            }
            this.source = null;
        }

        if (this.analyser) {
            try {
                this.analyser.disconnect();
            } catch (e) {
                // Already disconnected
            }
            this.analyser = null;
        }

        // Reset state
        this.energyHistory = [];
        this.previousEnergy = 0;
        this.beatIntensity = 0;
        this.lastBeatTime = 0;
    }

    /**
     * Analyze current audio frame
     * Call this every animation frame when audio is playing
     */
    analyze(): AudioData {
        if (!this.analyser) {
            return this.currentData;
        }

        const now = performance.now();

        // Get frequency data
        this.analyser.getByteFrequencyData(this.frequencyData as Uint8Array<ArrayBuffer>);
        this.analyser.getByteTimeDomainData(this.timeData as Uint8Array<ArrayBuffer>);

        const bufferLength = this.frequencyData.length;

        // Calculate frequency band energies
        // Typical FFT bins for ~44.1kHz sample rate with 256 FFT:
        // Each bin = ~172Hz
        // Bass: 0-4 bins (0-688Hz)
        // Mid: 4-20 bins (688-3440Hz)  
        // High: 20+ bins (3440Hz+)

        const bassEnd = Math.floor(bufferLength * 0.06);    // ~6% = low bass
        const midEnd = Math.floor(bufferLength * 0.25);     // 6-25% = mids

        let bassSum = 0;
        let midSum = 0;
        let highSum = 0;
        let totalSum = 0;

        for (let i = 0; i < bufferLength; i++) {
            const value = this.frequencyData[i] / 255;
            totalSum += value;

            if (i < bassEnd) {
                bassSum += value;
            } else if (i < midEnd) {
                midSum += value;
            } else {
                highSum += value;
            }
        }

        // Normalize by bin count
        const bass = bassEnd > 0 ? (bassSum / bassEnd) : 0;
        const mid = (midEnd - bassEnd) > 0 ? (midSum / (midEnd - bassEnd)) : 0;
        const high = (bufferLength - midEnd) > 0 ? (highSum / (bufferLength - midEnd)) : 0;
        const energy = bufferLength > 0 ? (totalSum / bufferLength) : 0;

        // Beat detection using energy flux
        this.energyHistory.push(energy);
        if (this.energyHistory.length > 43) { // ~0.7 seconds at 60fps
            this.energyHistory.shift();
        }

        // Calculate average energy and variance
        const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
        const variance = this.energyHistory.reduce((sum, e) => sum + Math.pow(e - avgEnergy, 2), 0) / this.energyHistory.length;
        const threshold = avgEnergy + Math.sqrt(variance) * (1 - this.config.beatSensitivity);

        // Detect beat: energy spike above threshold + time since last beat
        const timeSinceLastBeat = now - this.lastBeatTime;
        const beatDetected =
            energy > threshold &&
            energy > this.previousEnergy * 1.1 &&
            timeSinceLastBeat > this.config.minBeatInterval &&
            bass > 0.2; // Bass-heavy beats only

        if (beatDetected) {
            this.lastBeatTime = now;
            this.beatIntensity = Math.min(1, bass * 1.5); // Beat intensity based on bass
        }

        // Decay beat intensity smoothly
        this.beatIntensity *= 0.92; // Decay rate

        this.previousEnergy = energy;

        // Update current data
        this.currentData = {
            energy,
            bass,
            mid,
            high,
            beatDetected,
            beatIntensity: this.beatIntensity,
            frequencyData: this.frequencyData,
            timeSinceLastBeat,
        };

        return this.currentData;
    }

    /**
     * Get the current audio data without re-analyzing
     */
    getCurrentData(): AudioData {
        return this.currentData;
    }

    /**
     * Check if analyzer is connected and ready
     */
    isConnected(): boolean {
        return this.analyser !== null && this.source !== null;
    }

    /**
     * Update configuration
     */
    setConfig(config: Partial<AudioAnalyzerConfig>): void {
        this.config = { ...this.config, ...config };

        if (this.analyser && config.smoothingTimeConstant !== undefined) {
            this.analyser.smoothingTimeConstant = config.smoothingTimeConstant;
        }
    }

    /**
     * Get config
     */
    getConfig(): AudioAnalyzerConfig {
        return { ...this.config };
    }
}
