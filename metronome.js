// Metronome Class
class Metronome {
    constructor() {
        this.bpm = 120;
        this.isRunning = false;
        this.mode = 'regular'; // 'regular', 'silent', 'auto'
        this.intervalId = null;
        this.audioContext = null;
        this.beatTimes = [];
        this.soundType = 'beep'; // 'beep', 'bass', 'cymbal', 'tock', 'riff4', 'riff8'
        this.beatCount = 0; // For tracking position in drum riffs
        
        // Auto mode properties
        this.isDetecting = false;
        this.detectedBeats = [];
        this.sensitivity = 5;
        this.offBeatCount = 0;
        this.lastBeatTime = 0;
        this.detectedBPM = null;
        
        // Accelerometer properties
        this.lastAcceleration = 0;
        this.currentAcceleration = 0;
        this.motionHandler = null;
        
        // Constants for beat detection
        this.BEAT_DEBOUNCE_MS = 200;
        this.MAX_SENSITIVITY = 10;
        
        // Constants for accelerometer beat detection
        this.BASE_ACCELERATION_THRESHOLD = 5;
        this.ACCELERATION_SENSITIVITY_MULTIPLIER = 1;
        this.MAX_ACCELERATION_DISPLAY = 10; // For visualization scaling
        this.ACCELERATION_HIGH_THRESHOLD = 40; // Percentage for high (orange) color
        this.ACCELERATION_VERY_HIGH_THRESHOLD = 70; // Percentage for very high (red) color
        
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
        this.accelerationBar = document.getElementById('accelerationBar');
        this.soundSelector = document.getElementById('soundSelector');
        
        // Beat info displays at the top
        this.beatStatusTop = document.getElementById('beatStatus');
        this.beatDetectedBpmTop = document.getElementById('beatDetectedBpm');
        this.beatAccuracyTopDisplay = document.getElementById('beatAccuracyTop');
        
        // Mode dropdown
        this.modeSelector = document.getElementById('modeSelector');
        
        // Auto mode elements
        this.autoModeSettings = document.getElementById('autoModeSettings');
        this.sensitivitySlider = document.getElementById('sensitivitySlider');
        this.sensitivityValue = document.getElementById('sensitivityValue');
        this.autoStatus = document.getElementById('autoStatus');
        this.detectedBpmDisplay = document.getElementById('detectedBpm');
        this.beatAccuracy = document.getElementById('beatAccuracy');
        
        // Info modal elements
        this.infoBtn = document.getElementById('infoBtn');
        this.infoModal = document.getElementById('infoModal');
        this.closeInfoBtn = document.getElementById('closeInfoBtn');
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
                // Also stop detection if in auto mode
                if (this.mode === 'auto' && this.isDetecting) {
                    this.stopDetection();
                }
            } else {
                this.start();
                // Auto-start detection if in auto mode
                if (this.mode === 'auto') {
                    this.startDetection();
                }
            }
        });

        // Sound selector
        this.soundSelector.addEventListener('change', (e) => {
            this.soundType = e.target.value;
            this.beatCount = 0; // Reset beat counter when changing sounds
        });

        // Mode dropdown
        this.modeSelector.addEventListener('change', (e) => {
            this.setMode(e.target.value);
        });

        // Sensitivity slider
        this.sensitivitySlider.addEventListener('input', (e) => {
            this.sensitivity = parseInt(e.target.value);
            this.sensitivityValue.textContent = this.sensitivity;
            // Higher sensitivity = fewer consecutive beats required to trigger alert
            this.consecutiveOffBeatsThreshold = Math.max(1, this.BASE_OFF_BEAT_THRESHOLD - Math.floor(this.sensitivity / this.SENSITIVITY_DIVISOR));
        });

        // Info button
        this.infoBtn.addEventListener('click', () => {
            this.infoModal.style.display = 'flex';
        });

        // Close info modal
        this.closeInfoBtn.addEventListener('click', () => {
            this.infoModal.style.display = 'none';
        });

        // Close modal when clicking outside
        this.infoModal.addEventListener('click', (e) => {
            if (e.target === this.infoModal) {
                this.infoModal.style.display = 'none';
            }
        });
    }

    setMode(mode) {
        const previousMode = this.mode;
        this.mode = mode;
        
        if (mode === 'regular') {
            this.autoModeSettings.style.display = 'none';
        } else if (mode === 'silent') {
            this.autoModeSettings.style.display = 'none';
        } else if (mode === 'auto') {
            this.autoModeSettings.style.display = 'block';
            // Auto-start detection when entering auto mode if metronome is running
            if (this.isRunning && !this.isDetecting) {
                this.startDetection();
            }
        }
        
        // Stop detection if switching away from auto mode
        if (previousMode === 'auto' && mode !== 'auto' && this.isDetecting) {
            this.stopDetection();
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
        this.beatCount = 0; // Reset beat counter
        
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
        
        // Increment beat counter for riffs
        this.beatCount++;
        
        // Sound based on mode
        if (this.mode === 'regular') {
            this.playSound();
        } else if (this.mode === 'auto') {
            // In auto mode, only play beep if user is off-beat
            if (this.offBeatCount >= this.consecutiveOffBeatsThreshold) {
                this.playSound();
            }
        }
        // Silent mode: no sound
    }

    playSound() {
        if (!this.audioContext) return;
        
        switch(this.soundType) {
            case 'beep':
                this.playBeep();
                break;
            case 'bass':
                this.playBassDrum();
                break;
            case 'cymbal':
                this.playCymbal();
                break;
            case 'tock':
                this.playTock();
                break;
            case 'riff4':
                this.playDrumRiff(4);
                break;
            case 'riff8':
                this.playDrumRiff(8);
                break;
            default:
                this.playBeep();
        }
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

    async startDetection() {
        try {
            // Check if device motion is supported
            if (!window.DeviceMotionEvent) {
                alert('Device motion is not supported on this device or browser.');
                return;
            }

            // Request permission for iOS 13+
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission !== 'granted') {
                    alert('Permission to access device motion was denied. Please enable motion permissions in your browser settings.');
                    return;
                }
            }

            this.isDetecting = true;
            this.autoStatus.textContent = 'Detecting motion...';
            this.autoStatus.classList.add('listening');
            
            this.detectedBeats = [];
            this.offBeatCount = 0;
            
            // Initialize top displays
            this.beatStatusTop.textContent = 'Detecting motion...';
            this.beatStatusTop.className = 'beat-info-value status-listening';
            this.beatDetectedBpmTop.textContent = '--';
            this.beatAccuracyTopDisplay.textContent = '--';
            
            // Start the metronome if not already running
            if (!this.isRunning) {
                this.start();
            }
            
            // Set up motion event listener
            this.motionHandler = (event) => this.handleMotion(event);
            window.addEventListener('devicemotion', this.motionHandler);
            
        } catch (error) {
            console.error('Error accessing device motion:', error);
            alert('Could not access device motion. Please ensure your device has an accelerometer and try again.');
        }
    }

    stopDetection() {
        this.isDetecting = false;
        this.autoStatus.textContent = 'Inactive';
        this.autoStatus.classList.remove('listening', 'alert');
        
        if (this.motionHandler) {
            window.removeEventListener('devicemotion', this.motionHandler);
            this.motionHandler = null;
        }
        
        this.detectedBeats = [];
        this.offBeatCount = 0;
        this.detectedBpmDisplay.textContent = '--';
        this.beatAccuracy.textContent = '--';
        
        // Reset top displays
        this.beatStatusTop.textContent = '--';
        this.beatStatusTop.className = 'beat-info-value status-inactive';
        this.beatDetectedBpmTop.textContent = '--';
        this.beatAccuracyTopDisplay.textContent = '--';
        
        // Reset acceleration bar
        this.updateAccelerationBar(0);
    }

    playBassDrum() {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Bass drum: low frequency with quick pitch drop
        oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.1);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.6, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.2);
    }

    playCymbal() {
        if (!this.audioContext) return;
        
        // Cymbal: use noise with bandpass filter
        const bufferSize = this.audioContext.sampleRate * 0.3;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate white noise
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;
        
        const bandpass = this.audioContext.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 5000;
        bandpass.Q.value = 1;
        
        const gainNode = this.audioContext.createGain();
        
        noise.connect(bandpass);
        bandpass.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        
        noise.start(this.audioContext.currentTime);
        noise.stop(this.audioContext.currentTime + 0.3);
    }

    playTock() {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Tock: woody sound - lower frequency square wave
        oscillator.frequency.value = 800;
        oscillator.type = 'square';
        
        gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.05);
    }

    playDrumRiff(count) {
        if (!this.audioContext) return;
        
        // Calculate position in the riff pattern (1-based)
        const position = ((this.beatCount - 1) % count) + 1;
        
        if (count === 4) {
            // 4-count pattern: Bass on 1 & 3, Cymbal on 2 & 4
            if (position === 1 || position === 3) {
                this.playBassDrum();
            } else {
                this.playCymbal();
            }
        } else if (count === 8) {
            // 8-count pattern: Bass on 1, 3, 5, 7; Cymbal on 2, 4, 6, 8
            if (position % 2 === 1) {
                this.playBassDrum();
            } else {
                this.playCymbal();
            }
        }
    }

    handleMotion(event) {
        if (!this.isDetecting) return;
        
        const acceleration = event.accelerationIncludingGravity;
        if (!acceleration) return;
        
        // Calculate total acceleration magnitude
        const x = acceleration.x || 0;
        const y = acceleration.y || 0;
        const z = acceleration.z || 0;
        const totalAcceleration = Math.sqrt(x * x + y * y + z * z);
        
        // Calculate change in acceleration
        const accelerationChange = Math.abs(totalAcceleration - this.lastAcceleration);
        this.lastAcceleration = totalAcceleration;
        this.currentAcceleration = accelerationChange;
        
        // Update acceleration visualization
        this.updateAccelerationBar(accelerationChange);
        
        // Detect beat based on acceleration threshold
        // Lower sensitivity = higher threshold (harder to detect)
        const threshold = this.BASE_ACCELERATION_THRESHOLD + ((this.MAX_SENSITIVITY - this.sensitivity) * this.ACCELERATION_SENSITIVITY_MULTIPLIER);
        
        if (accelerationChange > threshold) {
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
                    this.beatDetectedBpmTop.textContent = this.detectedBPM;
                }
                
                // Check if beat is on time with metronome
                this.checkBeatAccuracy(now);
            }
        }
    }

    updateAccelerationBar(accelerationChange) {
        // Normalize acceleration to percentage (0-100%)
        const percentage = Math.min(100, (accelerationChange / this.MAX_ACCELERATION_DISPLAY) * 100);
        this.accelerationBar.style.height = `${percentage}%`;
        
        // Update color based on intensity
        this.accelerationBar.classList.remove('high', 'very-high');
        if (percentage > this.ACCELERATION_VERY_HIGH_THRESHOLD) {
            this.accelerationBar.classList.add('very-high');
        } else if (percentage > this.ACCELERATION_HIGH_THRESHOLD) {
            this.accelerationBar.classList.add('high');
        }
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
            this.beatAccuracyTopDisplay.textContent = `${accuracy}%`;
            this.autoStatus.textContent = 'On beat';
            this.autoStatus.classList.remove('alert');
            this.autoStatus.classList.add('listening');
            this.beatStatusTop.textContent = 'On beat';
            this.beatStatusTop.className = 'beat-info-value status-listening';
        } else {
            this.offBeatCount++;
            const accuracy = Math.round((1 - closestDiff / beatInterval) * 100);
            this.beatAccuracy.textContent = `${accuracy}% (Off beat)`;
            this.beatAccuracyTopDisplay.textContent = `${accuracy}%`;
            
            if (this.offBeatCount >= this.consecutiveOffBeatsThreshold) {
                this.autoStatus.textContent = 'Off beat - Beeping!';
                this.autoStatus.classList.remove('listening');
                this.autoStatus.classList.add('alert');
                this.beatStatusTop.textContent = 'Off beat!';
                this.beatStatusTop.className = 'beat-info-value status-alert';
            }
        }
    }
}

// Initialize metronome when page loads
document.addEventListener('DOMContentLoaded', () => {
    const metronome = new Metronome();
});
