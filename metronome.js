// Metronome Class
class Metronome {
    constructor() {
        this.bpm = 120;
        this.isRunning = false;
        this.mode = 'regular'; // 'regular', 'silent', 'auto'
        this.intervalId = null;
        this.audioContext = null;
        this.beatTimes = [];
        
        // Auto mode properties
        this.isListening = false;
        this.mediaStream = null;
        this.analyser = null;
        this.detectedBeats = [];
        this.sensitivity = 5;
        this.offBeatCount = 0;
        this.lastBeatTime = 0;
        this.detectedBPM = null;
        
        // Constants for beat detection
        this.BEAT_DEBOUNCE_MS = 200;
        this.BASE_VOLUME_THRESHOLD = 50;
        this.SENSITIVITY_MULTIPLIER = 5;
        this.MAX_SENSITIVITY = 10;
        this.LOW_FREQUENCY_DIVISOR = 4;
        
        // Constants for off-beat threshold calculation
        this.BASE_OFF_BEAT_THRESHOLD = 6;
        this.SENSITIVITY_DIVISOR = 2;
        this.consecutiveOffBeatsThreshold = this.BASE_OFF_BEAT_THRESHOLD;
        
        // Constants for timing tolerance
        this.BASE_TOLERANCE_PERCENTAGE = 0.20;
        this.TOLERANCE_ADJUSTMENT_FACTOR = 0.02;
        
        this.initializeUI();
        this.setupEventListeners();
    }

    initializeUI() {
        // DOM elements
        this.bpmSlider = document.getElementById('bpmSlider');
        this.bpmValue = document.getElementById('bpmValue');
        this.startStopBtn = document.getElementById('startStop');
        this.pulseElement = document.getElementById('pulse');
        
        // Mode buttons
        this.modeRegularBtn = document.getElementById('modeRegular');
        this.modeSilentBtn = document.getElementById('modeSilent');
        this.modeAutoBtn = document.getElementById('modeAuto');
        
        // Auto mode elements
        this.autoModeSettings = document.getElementById('autoModeSettings');
        this.sensitivitySlider = document.getElementById('sensitivitySlider');
        this.sensitivityValue = document.getElementById('sensitivityValue');
        this.startListeningBtn = document.getElementById('startListening');
        this.autoStatus = document.getElementById('autoStatus');
        this.detectedBpmDisplay = document.getElementById('detectedBpm');
        this.beatAccuracy = document.getElementById('beatAccuracy');
    }

    setupEventListeners() {
        // BPM slider
        this.bpmSlider.addEventListener('input', (e) => {
            this.bpm = parseInt(e.target.value);
            this.bpmValue.textContent = this.bpm;
            if (this.isRunning) {
                this.stop();
                this.start();
            }
        });

        // Start/Stop button
        this.startStopBtn.addEventListener('click', () => {
            if (this.isRunning) {
                this.stop();
            } else {
                this.start();
            }
        });

        // Mode buttons
        this.modeRegularBtn.addEventListener('click', () => this.setMode('regular'));
        this.modeSilentBtn.addEventListener('click', () => this.setMode('silent'));
        this.modeAutoBtn.addEventListener('click', () => this.setMode('auto'));

        // Sensitivity slider
        this.sensitivitySlider.addEventListener('input', (e) => {
            this.sensitivity = parseInt(e.target.value);
            this.sensitivityValue.textContent = this.sensitivity;
            // Higher sensitivity = fewer consecutive beats required to trigger alert
            this.consecutiveOffBeatsThreshold = Math.max(1, this.BASE_OFF_BEAT_THRESHOLD - Math.floor(this.sensitivity / this.SENSITIVITY_DIVISOR));
        });

        // Start listening button
        this.startListeningBtn.addEventListener('click', () => {
            if (this.isListening) {
                this.stopListening();
            } else {
                this.startListening();
            }
        });
    }

    setMode(mode) {
        this.mode = mode;
        
        // Update button states
        this.modeRegularBtn.classList.remove('active');
        this.modeSilentBtn.classList.remove('active');
        this.modeAutoBtn.classList.remove('active');
        
        if (mode === 'regular') {
            this.modeRegularBtn.classList.add('active');
            this.autoModeSettings.style.display = 'none';
        } else if (mode === 'silent') {
            this.modeSilentBtn.classList.add('active');
            this.autoModeSettings.style.display = 'none';
        } else if (mode === 'auto') {
            this.modeAutoBtn.classList.add('active');
            this.autoModeSettings.style.display = 'block';
        }
        
        // Stop listening if switching away from auto mode
        if (mode !== 'auto' && this.isListening) {
            this.stopListening();
        }
    }

    start() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        this.isRunning = true;
        this.startStopBtn.textContent = 'Stop';
        this.startStopBtn.classList.add('active');
        this.beatTimes = [];
        
        this.scheduleBeat();
    }

    stop() {
        this.isRunning = false;
        this.startStopBtn.textContent = 'Start';
        this.startStopBtn.classList.remove('active');
        
        if (this.intervalId) {
            clearTimeout(this.intervalId);
            this.intervalId = null;
        }
    }

    scheduleBeat() {
        if (!this.isRunning) return;
        
        const beatInterval = (60 / this.bpm) * 1000; // Convert BPM to milliseconds
        this.playBeat();
        
        this.intervalId = setTimeout(() => {
            this.scheduleBeat();
        }, beatInterval);
    }

    playBeat() {
        // Visual pulse
        this.pulseElement.classList.add('active');
        setTimeout(() => {
            this.pulseElement.classList.remove('active');
        }, 100);
        
        // Store beat time for auto mode
        this.lastBeatTime = Date.now();
        this.beatTimes.push(this.lastBeatTime);
        if (this.beatTimes.length > 10) {
            this.beatTimes.shift();
        }
        
        // Sound based on mode
        if (this.mode === 'regular') {
            this.playBeep();
        } else if (this.mode === 'auto') {
            // In auto mode, only play beep if user is off-beat
            if (this.offBeatCount >= this.consecutiveOffBeatsThreshold) {
                this.playBeep();
            }
        }
        // Silent mode: no sound
    }

    playBeep() {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = 1000; // 1000 Hz beep
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.1);
    }

    async startListening() {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;
            
            source.connect(this.analyser);
            
            this.isListening = true;
            this.startListeningBtn.textContent = 'Stop Listening';
            this.startListeningBtn.classList.add('active');
            this.autoStatus.textContent = 'Listening...';
            this.autoStatus.classList.add('listening');
            
            this.detectedBeats = [];
            this.offBeatCount = 0;
            
            // Start the metronome if not already running
            if (!this.isRunning) {
                this.start();
            }
            
            this.detectBeats();
            
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please grant permission and try again.');
        }
    }

    stopListening() {
        this.isListening = false;
        this.startListeningBtn.textContent = 'Start Listening';
        this.startListeningBtn.classList.remove('active');
        this.autoStatus.textContent = 'Inactive';
        this.autoStatus.classList.remove('listening', 'alert');
        
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        this.detectedBeats = [];
        this.offBeatCount = 0;
        this.detectedBpmDisplay.textContent = '--';
        this.beatAccuracy.textContent = '--';
    }

    detectBeats() {
        if (!this.isListening) return;
        
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume in lower frequencies (where beats typically are)
        let sum = 0;
        const lowFreqRange = Math.floor(bufferLength / this.LOW_FREQUENCY_DIVISOR); // Focus on lower frequencies
        for (let i = 0; i < lowFreqRange; i++) {
            sum += dataArray[i];
        }
        const average = sum / lowFreqRange;
        
        // Detect beat based on volume threshold
        // Higher sensitivity = lower threshold (easier to detect beats)
        const threshold = this.BASE_VOLUME_THRESHOLD + ((this.MAX_SENSITIVITY - this.sensitivity) * this.SENSITIVITY_MULTIPLIER);
        
        if (average > threshold) {
            const now = Date.now();
            
            // Avoid detecting the same beat multiple times
            if (this.detectedBeats.length === 0 || (now - this.detectedBeats[this.detectedBeats.length - 1]) > this.BEAT_DEBOUNCE_MS) {
                this.detectedBeats.push(now);
                
                // Keep only recent beats
                if (this.detectedBeats.length > 10) {
                    this.detectedBeats.shift();
                }
                
                // Calculate detected BPM
                if (this.detectedBeats.length >= 3) {
                    const intervals = [];
                    for (let i = 1; i < this.detectedBeats.length; i++) {
                        intervals.push(this.detectedBeats[i] - this.detectedBeats[i - 1]);
                    }
                    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                    this.detectedBPM = Math.round(60000 / avgInterval);
                    this.detectedBpmDisplay.textContent = this.detectedBPM;
                }
                
                // Check if beat is on time with metronome
                this.checkBeatAccuracy(now);
            }
        }
        
        // Continue detecting
        requestAnimationFrame(() => this.detectBeats());
    }

    checkBeatAccuracy(detectedBeatTime) {
        if (this.beatTimes.length === 0) return;
        
        const beatInterval = (60 / this.bpm) * 1000;
        // Adjust tolerance based on sensitivity: higher sensitivity = tighter tolerance
        const toleranceAdjustment = (this.MAX_SENSITIVITY - this.sensitivity) * this.TOLERANCE_ADJUSTMENT_FACTOR;
        const tolerance = beatInterval * (this.BASE_TOLERANCE_PERCENTAGE + toleranceAdjustment);
        
        // Find the closest metronome beat
        let minDiff = Infinity;
        for (const beatTime of this.beatTimes) {
            const diff = Math.abs(detectedBeatTime - beatTime);
            if (diff < minDiff) {
                minDiff = diff;
            }
        }
        
        // Also check against expected next beat
        const timeSinceLastBeat = detectedBeatTime - this.lastBeatTime;
        const diffFromExpected = Math.abs(timeSinceLastBeat % beatInterval);
        const diffFromExpectedAlt = beatInterval - diffFromExpected;
        const closestDiff = Math.min(minDiff, diffFromExpected, diffFromExpectedAlt);
        
        // Check if beat is within tolerance
        const isOnBeat = closestDiff < tolerance;
        
        if (isOnBeat) {
            this.offBeatCount = Math.max(0, this.offBeatCount - 1);
            const accuracy = Math.round((1 - closestDiff / beatInterval) * 100);
            this.beatAccuracy.textContent = `${accuracy}% (On beat)`;
            this.autoStatus.textContent = 'On beat';
            this.autoStatus.classList.remove('alert');
            this.autoStatus.classList.add('listening');
        } else {
            this.offBeatCount++;
            const accuracy = Math.round((1 - closestDiff / beatInterval) * 100);
            this.beatAccuracy.textContent = `${accuracy}% (Off beat)`;
            
            if (this.offBeatCount >= this.consecutiveOffBeatsThreshold) {
                this.autoStatus.textContent = 'Off beat - Beeping!';
                this.autoStatus.classList.remove('listening');
                this.autoStatus.classList.add('alert');
            }
        }
    }
}

// Initialize metronome when page loads
document.addEventListener('DOMContentLoaded', () => {
    const metronome = new Metronome();
});
