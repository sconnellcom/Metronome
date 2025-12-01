// Instrument Tuner Class
class Tuner {
    constructor() {
        // Audio context and analysis
        this.audioContext = null;
        this.analyser = null;
        this.mediaStream = null;
        this.sourceNode = null;  // Store source node to prevent garbage collection
        this.gainNode = null;    // Gain node for volume control
        this.dataArray = null;
        this.bufferLength = 0;
        this.isRunning = false;
        this.animationId = null;
        
        // Volume/gain settings
        this.inputGain = 80;    // Default gain (80 = moderate amplification)

        // Tuning settings
        this.referencePitch = 440; // A4 reference frequency
        this.minFrequency = 60;    // Minimum detectable frequency
        this.maxFrequency = 1500;  // Maximum detectable frequency

        // Audio level meter thresholds (percentage values)
        // RMS values from microphones are typically very low (0.01-0.1 range)
        // Multiplier of 500 provides good sensitivity for typical microphone input
        this.RMS_TO_PERCENTAGE_MULTIPLIER = 500;
        this.NO_SIGNAL_THRESHOLD = 1;    // Below this: "No signal"
        this.QUIET_THRESHOLD = 10;       // Below this: "Too quiet"
        this.LOW_THRESHOLD = 30;         // Below this: "Low", above: "Good"

        // Note names
        this.noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // Instrument presets with string frequencies
        this.instruments = {
            'guitar': {
                name: 'Guitar (Standard)',
                strings: [
                    { note: 'E', octave: 2, frequency: 82.41 },
                    { note: 'A', octave: 2, frequency: 110.00 },
                    { note: 'D', octave: 3, frequency: 146.83 },
                    { note: 'G', octave: 3, frequency: 196.00 },
                    { note: 'B', octave: 3, frequency: 246.94 },
                    { note: 'E', octave: 4, frequency: 329.63 }
                ]
            },
            'guitar-dropd': {
                name: 'Guitar (Drop D)',
                strings: [
                    { note: 'D', octave: 2, frequency: 73.42 },
                    { note: 'A', octave: 2, frequency: 110.00 },
                    { note: 'D', octave: 3, frequency: 146.83 },
                    { note: 'G', octave: 3, frequency: 196.00 },
                    { note: 'B', octave: 3, frequency: 246.94 },
                    { note: 'E', octave: 4, frequency: 329.63 }
                ]
            },
            'bass': {
                name: 'Bass (4-string)',
                strings: [
                    { note: 'E', octave: 1, frequency: 41.20 },
                    { note: 'A', octave: 1, frequency: 55.00 },
                    { note: 'D', octave: 2, frequency: 73.42 },
                    { note: 'G', octave: 2, frequency: 98.00 }
                ]
            },
            'bass5': {
                name: 'Bass (5-string)',
                strings: [
                    { note: 'B', octave: 0, frequency: 30.87 },
                    { note: 'E', octave: 1, frequency: 41.20 },
                    { note: 'A', octave: 1, frequency: 55.00 },
                    { note: 'D', octave: 2, frequency: 73.42 },
                    { note: 'G', octave: 2, frequency: 98.00 }
                ]
            },
            'ukulele': {
                name: 'Ukulele',
                strings: [
                    { note: 'G', octave: 4, frequency: 392.00 },
                    { note: 'C', octave: 4, frequency: 261.63 },
                    { note: 'E', octave: 4, frequency: 329.63 },
                    { note: 'A', octave: 4, frequency: 440.00 }
                ]
            },
            'violin': {
                name: 'Violin',
                strings: [
                    { note: 'G', octave: 3, frequency: 196.00 },
                    { note: 'D', octave: 4, frequency: 293.66 },
                    { note: 'A', octave: 4, frequency: 440.00 },
                    { note: 'E', octave: 5, frequency: 659.26 }
                ]
            },
            'viola': {
                name: 'Viola',
                strings: [
                    { note: 'C', octave: 3, frequency: 130.81 },
                    { note: 'G', octave: 3, frequency: 196.00 },
                    { note: 'D', octave: 4, frequency: 293.66 },
                    { note: 'A', octave: 4, frequency: 440.00 }
                ]
            },
            'cello': {
                name: 'Cello',
                strings: [
                    { note: 'C', octave: 2, frequency: 65.41 },
                    { note: 'G', octave: 2, frequency: 98.00 },
                    { note: 'D', octave: 3, frequency: 146.83 },
                    { note: 'A', octave: 3, frequency: 220.00 }
                ]
            },
            'chromatic': {
                name: 'Chromatic',
                strings: []
            }
        };

        this.currentInstrument = 'guitar';
        this.selectedString = null;

        // Smoothing for display
        this.smoothedCents = 0;
        this.smoothingFactor = 0.3;

        this.initializeUI();
        this.setupEventListeners();
        this.initializeTheme();
        this.updateStringButtons();
    }

    initializeTheme() {
        // Use shared 'appTheme' key for consistency across all apps
        const savedTheme = localStorage.getItem('appTheme') || 'default';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-warm-light', 'theme-warm-dark', 'theme-red', 'theme-pink', 'theme-red-dark', 'theme-pink-dark', 'theme-black', 'theme-blue', 'theme-blue-dark');

        if (theme !== 'default') {
            document.body.classList.add(`theme-${theme}`);
        }

        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.theme === theme) {
                btn.classList.add('active');
            }
        });

        this.themeBtnActive.className = `theme-btn-active theme-${theme}`;
        // Save to localStorage using shared key for all apps
        localStorage.setItem('appTheme', theme);
    }

    initializeUI() {
        // DOM elements
        this.startStopBtn = document.getElementById('startStop');
        this.instrumentSelect = document.getElementById('instrumentSelect');
        this.stringButtons = document.getElementById('stringButtons');
        this.detectedNote = document.getElementById('detectedNote');
        this.octaveDisplay = document.getElementById('octaveDisplay');
        this.gaugeNeedle = document.getElementById('gaugeNeedle');
        this.centsValue = document.getElementById('centsValue');
        this.frequencyValue = document.getElementById('frequencyValue');
        this.tuningStatus = document.getElementById('tuningStatus');
        this.referencePitchSlider = document.getElementById('referencePitch');
        this.referencePitchValue = document.getElementById('referencePitchValue');
        this.permissionOverlay = document.getElementById('permissionOverlay');
        this.permissionBtn = document.getElementById('permissionBtn');
        this.errorMessage = document.getElementById('errorMessage');
        this.audioLevelBar = document.getElementById('audioLevelBar');
        this.audioLevelStatus = document.getElementById('audioLevelStatus');
        
        // Volume/gain control elements
        this.inputGainSlider = document.getElementById('inputGain');
        this.inputGainValue = document.getElementById('inputGainValue');

        // Theme elements
        this.themeBtnActive = document.querySelector('.theme-btn-active');
        this.themeDropdown = document.querySelector('.theme-dropdown');

        // Info modal elements
        this.infoBtn = document.getElementById('infoBtn');
        this.infoModal = document.getElementById('infoModal');
        this.closeInfoBtn = document.getElementById('closeInfoBtn');
    }

    setupEventListeners() {
        // Start/Stop button
        this.startStopBtn.addEventListener('click', () => {
            if (this.isRunning) {
                this.stop();
            } else {
                this.start();
            }
        });

        // Instrument selection
        this.instrumentSelect.addEventListener('change', (e) => {
            this.currentInstrument = e.target.value;
            this.selectedString = null;
            this.updateStringButtons();
        });

        // Reference pitch slider
        this.referencePitchSlider.addEventListener('input', (e) => {
            this.referencePitch = parseInt(e.target.value);
            this.referencePitchValue.textContent = this.referencePitch;
        });
        
        // Input gain/volume slider
        this.inputGainSlider.addEventListener('input', (e) => {
            this.inputGain = parseInt(e.target.value);
            this.inputGainValue.textContent = this.inputGain;
            // Update gain node if it exists, using setValueAtTime for smooth transitions
            if (this.gainNode && this.audioContext) {
                this.gainNode.gain.setValueAtTime(this.inputGain, this.audioContext.currentTime);
            }
        });

        // Permission button
        this.permissionBtn.addEventListener('click', () => {
            this.requestMicrophoneAccess();
        });

        // Theme switcher
        this.themeBtnActive.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = this.themeDropdown.style.display === 'grid';
            this.themeDropdown.style.display = isVisible ? 'none' : 'grid';
        });

        document.querySelectorAll('.theme-dropdown .theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setTheme(btn.dataset.theme);
                this.themeDropdown.style.display = 'none';
            });
        });

        document.addEventListener('click', (e) => {
            if (!this.themeBtnActive.contains(e.target) && !this.themeDropdown.contains(e.target)) {
                this.themeDropdown.style.display = 'none';
            }
        });

        // Info modal
        this.infoBtn.addEventListener('click', () => {
            this.infoModal.style.display = 'flex';
        });

        this.closeInfoBtn.addEventListener('click', () => {
            this.infoModal.style.display = 'none';
        });

        this.infoModal.addEventListener('click', (e) => {
            if (e.target === this.infoModal) {
                this.infoModal.style.display = 'none';
            }
        });
    }

    updateStringButtons() {
        const instrument = this.instruments[this.currentInstrument];
        this.stringButtons.innerHTML = '';

        if (instrument.strings.length === 0) {
            // Chromatic mode - no string buttons
            return;
        }

        instrument.strings.forEach((string, index) => {
            const btn = document.createElement('button');
            btn.className = 'string-btn';
            btn.textContent = `${string.note}${string.octave}`;
            btn.dataset.index = index;

            btn.addEventListener('click', () => {
                this.selectString(index);
            });

            this.stringButtons.appendChild(btn);
        });
    }

    selectString(index) {
        this.selectedString = index;

        // Update button states
        document.querySelectorAll('.string-btn').forEach((btn, i) => {
            btn.classList.toggle('active', i === index);
            btn.classList.remove('in-tune');
        });
    }

    async start() {
        try {
            // Check if we need to show permission overlay
            if (!this.mediaStream) {
                await this.requestMicrophoneAccess();
            }

            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Set up analyser
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 4096;
            this.bufferLength = this.analyser.fftSize;
            this.dataArray = new Float32Array(this.bufferLength);

            // Set up gain node for volume control
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.setValueAtTime(this.inputGain, this.audioContext.currentTime);

            // Connect microphone -> gain -> analyser
            // Store source node as instance variable to prevent garbage collection
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.sourceNode.connect(this.gainNode);
            this.gainNode.connect(this.analyser);

            this.isRunning = true;
            this.startStopBtn.textContent = 'Stop Tuner';
            this.startStopBtn.classList.add('active');

            // Start pitch detection loop
            this.detectPitch();

        } catch (error) {
            console.error('Error starting tuner:', error);
            this.showError('Unable to start tuner. Please check microphone permissions.');
        }
    }

    async requestMicrophoneAccess() {
        try {
            this.permissionOverlay.style.display = 'none';

            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

        } catch (error) {
            console.error('Microphone access denied:', error);
            this.permissionOverlay.style.display = 'flex';
            throw error;
        }
    }

    stop() {
        this.isRunning = false;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Disconnect audio nodes to clean up resources
        if (this.gainNode) {
            this.gainNode.disconnect();
            this.gainNode = null;
        }
        if (this.sourceNode) {
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }

        this.startStopBtn.textContent = 'Start Tuner';
        this.startStopBtn.classList.remove('active');

        // Reset display
        this.resetDisplay();
    }

    resetDisplay() {
        this.detectedNote.textContent = '--';
        this.detectedNote.className = 'detected-note';
        this.octaveDisplay.textContent = '';
        this.centsValue.textContent = '--';
        this.centsValue.className = 'cents-value';
        this.frequencyValue.textContent = '--';
        this.gaugeNeedle.style.left = '50%';
        this.gaugeNeedle.className = 'gauge-needle';
        this.tuningStatus.className = 'tuning-status';
        this.tuningStatus.querySelector('.status-text').textContent = 'Ready to tune';
        
        // Reset audio level meter
        this.audioLevelBar.style.width = '0%';
        this.audioLevelBar.classList.remove('low', 'medium', 'good');
        this.audioLevelStatus.textContent = 'No signal';
        this.audioLevelStatus.classList.remove('weak', 'good');
        this.audioLevelStatus.classList.add('no-signal');
    }

    detectPitch() {
        if (!this.isRunning) return;

        this.analyser.getFloatTimeDomainData(this.dataArray);

        // Calculate RMS for audio level display
        let rms = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            rms += this.dataArray[i] * this.dataArray[i];
        }
        rms = Math.sqrt(rms / this.dataArray.length);

        // Update audio level meter
        this.updateAudioLevel(rms);

        // Use autocorrelation to detect pitch
        const frequency = this.autoCorrelate(this.dataArray, this.audioContext.sampleRate);

        if (frequency !== -1 && frequency >= this.minFrequency && frequency <= this.maxFrequency) {
            this.updateDisplay(frequency);
        }

        this.animationId = requestAnimationFrame(() => this.detectPitch());
    }

    updateAudioLevel(rms) {
        // Convert RMS to a percentage (0-100)
        const percentage = Math.min(100, rms * this.RMS_TO_PERCENTAGE_MULTIPLIER);
        
        this.audioLevelBar.style.width = percentage + '%';
        
        // Update bar color and status based on level
        this.audioLevelBar.classList.remove('low', 'medium', 'good');
        this.audioLevelStatus.classList.remove('no-signal', 'weak', 'good');
        
        if (percentage < this.NO_SIGNAL_THRESHOLD) {
            this.audioLevelStatus.textContent = 'No signal';
            this.audioLevelStatus.classList.add('no-signal');
        } else if (percentage < this.QUIET_THRESHOLD) {
            this.audioLevelBar.classList.add('low');
            this.audioLevelStatus.textContent = 'Too quiet';
            this.audioLevelStatus.classList.add('weak');
        } else if (percentage < this.LOW_THRESHOLD) {
            this.audioLevelBar.classList.add('medium');
            this.audioLevelStatus.textContent = 'Low';
            this.audioLevelStatus.classList.add('weak');
        } else {
            this.audioLevelBar.classList.add('good');
            this.audioLevelStatus.textContent = 'Good';
            this.audioLevelStatus.classList.add('good');
        }
    }

    autoCorrelate(buffer, sampleRate) {
        // Find the RMS of the signal
        let rms = 0;
        for (let i = 0; i < buffer.length; i++) {
            rms += buffer[i] * buffer[i];
        }
        rms = Math.sqrt(rms / buffer.length);

        // If too quiet, return -1
        // Threshold of 0.002 RMS corresponds to 1% audio level (0.002 × 500 = 1)
        // This matches the audio level meter's NO_SIGNAL_THRESHOLD percentage
        if (rms < 0.002) return -1;

        // Autocorrelation using normalized difference function
        const SIZE = buffer.length;
        const MAX_SAMPLES = Math.floor(SIZE / 2);
        // Minimum offset to skip trivial self-correlation at offset 0
        // This corresponds to the maximum detectable frequency
        // At 44100 Hz sample rate: offset 20 = 2205 Hz, offset 30 = 1470 Hz
        const MIN_OFFSET = 20;
        let bestOffset = -1;
        let bestCorrelation = 0;
        let foundGoodCorrelation = false;
        const correlations = new Array(MAX_SAMPLES);

        for (let offset = MIN_OFFSET; offset < MAX_SAMPLES; offset++) {
            let correlation = 0;
            let denominator = 0;
            const loopLimit = MAX_SAMPLES - offset;

            for (let i = 0; i < loopLimit; i++) {
                const diff = buffer[i] - buffer[i + offset];
                correlation += diff * diff;
                denominator += buffer[i] * buffer[i] + buffer[i + offset] * buffer[i + offset];
            }

            // Normalize correlation: 1 when perfectly correlated, 0 when uncorrelated
            correlation = denominator > 0 ? 1 - (correlation / denominator) : 0;
            correlations[offset] = correlation;

            // Use a lower threshold (0.3) for initial detection to handle real-world audio with noise
            if ((correlation > 0.3) && (correlation > bestCorrelation)) {
                bestCorrelation = correlation;
                bestOffset = offset;
                foundGoodCorrelation = true;
            } else if (foundGoodCorrelation) {
                // Short-circuit once we've found a good correlation and it starts decreasing
                // At this point, bestOffset >= MIN_OFFSET since we only set foundGoodCorrelation
                // when we also set bestOffset = offset (where offset >= MIN_OFFSET)
                if (bestOffset >= MIN_OFFSET && bestOffset < MAX_SAMPLES - 1 && correlations[bestOffset] !== 0) {
                    // Parabolic interpolation to refine the peak position
                    // The factor 8 is an empirical refinement constant for pitch detection accuracy
                    const shift = (correlations[bestOffset + 1] - correlations[bestOffset - 1]) / correlations[bestOffset];
                    return sampleRate / (bestOffset + (8 * shift));
                }
                return sampleRate / bestOffset;
            }
        }

        if (bestCorrelation > 0.01 && bestOffset >= MIN_OFFSET) {
            return sampleRate / bestOffset;
        }

        return -1;
    }

    updateDisplay(frequency) {
        // Get note info from frequency
        const noteInfo = this.frequencyToNote(frequency);

        // Update note display
        this.detectedNote.textContent = noteInfo.note;
        this.octaveDisplay.textContent = `Octave ${noteInfo.octave}`;
        this.frequencyValue.textContent = frequency.toFixed(1);

        // Smooth the cents value
        this.smoothedCents = this.smoothedCents * (1 - this.smoothingFactor) + noteInfo.cents * this.smoothingFactor;
        const displayCents = Math.round(this.smoothedCents);

        // Update cents display
        const centsPrefix = displayCents > 0 ? '+' : '';
        this.centsValue.textContent = centsPrefix + displayCents;

        // Update gauge needle position (map -50 to +50 cents to 0% to 100%)
        const needlePosition = ((this.smoothedCents + 50) / 100) * 100;
        const clampedPosition = Math.max(0, Math.min(100, needlePosition));
        this.gaugeNeedle.style.left = clampedPosition + '%';

        // Determine tuning accuracy
        const absCents = Math.abs(displayCents);
        let tuningClass = '';
        let statusText = '';

        if (absCents <= 5) {
            tuningClass = 'in-tune';
            statusText = '✓ In Tune!';
        } else if (absCents <= 15) {
            tuningClass = 'close';
            statusText = displayCents < 0 ? '↑ Tune Up (slightly flat)' : '↓ Tune Down (slightly sharp)';
        } else {
            tuningClass = 'out-tune';
            statusText = displayCents < 0 ? '↑↑ Tune Up (flat)' : '↓↓ Tune Down (sharp)';
        }

        // Apply classes
        this.detectedNote.className = 'detected-note ' + tuningClass;
        this.centsValue.className = 'cents-value ' + tuningClass;
        this.gaugeNeedle.className = 'gauge-needle ' + tuningClass;
        this.tuningStatus.className = 'tuning-status ' + tuningClass;
        this.tuningStatus.querySelector('.status-text').textContent = statusText;

        // Update string button if in tune
        if (this.selectedString !== null && tuningClass === 'in-tune') {
            const stringBtns = document.querySelectorAll('.string-btn');
            if (stringBtns[this.selectedString]) {
                const targetString = this.instruments[this.currentInstrument].strings[this.selectedString];
                if (noteInfo.note === targetString.note && noteInfo.octave === targetString.octave) {
                    stringBtns[this.selectedString].classList.add('in-tune');
                }
            }
        }

        // Highlight matching string for current instrument
        this.highlightMatchingString(noteInfo);
    }

    highlightMatchingString(noteInfo) {
        const instrument = this.instruments[this.currentInstrument];
        if (instrument.strings.length === 0) return;

        const stringBtns = document.querySelectorAll('.string-btn');
        stringBtns.forEach((btn, index) => {
            const string = instrument.strings[index];
            if (string.note === noteInfo.note && string.octave === noteInfo.octave) {
                if (!btn.classList.contains('in-tune')) {
                    btn.classList.add('active');
                }
            } else if (this.selectedString !== index) {
                btn.classList.remove('active');
            }
        });
    }

    frequencyToNote(frequency) {
        // Calculate how many half steps away from A4
        const halfStepsFromA4 = 12 * Math.log2(frequency / this.referencePitch);
        const roundedHalfSteps = Math.round(halfStepsFromA4);

        // Calculate cents deviation
        const cents = (halfStepsFromA4 - roundedHalfSteps) * 100;

        // Calculate note index and octave
        // In our noteNames array: C=0, C#=1, D=2, ..., A=9, A#=10, B=11
        // A4 is at index 9 in the array
        const noteIndex = ((roundedHalfSteps % 12) + 12 + 9) % 12; // +9 because A is at index 9
        const octave = Math.floor((roundedHalfSteps + 9) / 12) + 4; // Adjust octave calculation

        return {
            note: this.noteNames[noteIndex],
            octave: octave,
            cents: cents,
            frequency: frequency
        };
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
    }

    hideError() {
        this.errorMessage.style.display = 'none';
    }
}

// Initialize tuner when page loads
document.addEventListener('DOMContentLoaded', () => {
    new Tuner();
});
