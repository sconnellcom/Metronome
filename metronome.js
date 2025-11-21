// Metronome Class
class Metronome {
    constructor() {
        this.bpm = 120;
        this.isRunning = false;
        this.mode = 'regular'; // 'regular', 'silent', 'auto'
        this.autoModeType = 'listen'; // 'listen' or 'vibrate'
        this.intervalId = null;
        this.audioContext = null;
        this.beatTimes = [];
        this.soundType = 'beep'; // 'beep', 'bass', 'cymbal', 'tock', 'riff4', 'riff8'
        this.beatCount = 0; // For tracking position in drum riffs
        
        // Auto mode properties
        this.isListening = false;
        this.isVibrating = false;
        this.mediaStream = null;
        this.analyser = null;
        this.detectedBeats = [];
        this.sensitivity = 5;
        this.offBeatCount = 0;
        this.lastBeatTime = 0;
        this.detectedBPM = null;
        
        // Accelerometer properties
        this.lastAcceleration = 0;
        this.motionHandler = null;
        
        // Constants for beat detection
        this.BEAT_DEBOUNCE_MS = 200;
        this.BASE_VOLUME_THRESHOLD = 50;
        this.SENSITIVITY_MULTIPLIER = 5;
        this.MAX_SENSITIVITY = 10;
        this.LOW_FREQUENCY_DIVISOR = 4;
        
        // Constants for accelerometer beat detection
        this.BASE_ACCELERATION_THRESHOLD = 5;
        this.ACCELERATION_SENSITIVITY_MULTIPLIER = 1;
        
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
        this.soundSelector = document.getElementById('soundSelector');
        
        // Mode buttons
        this.modeRegularBtn = document.getElementById('modeRegular');
        this.modeSilentBtn = document.getElementById('modeSilent');
        this.modeAutoBtn = document.getElementById('modeAuto');
        
        // Auto mode elements
        this.autoModeSettings = document.getElementById('autoModeSettings');
        this.autoModeTypeRadios = document.querySelectorAll('input[name="autoModeType"]');
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

        // Sound selector
        this.soundSelector.addEventListener('change', (e) => {
            this.soundType = e.target.value;
            this.beatCount = 0; // Reset beat counter when changing sounds
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

        // Auto mode type radio buttons
        this.autoModeTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.autoModeType = e.target.value;
                // Stop current detection if active
                if (this.isListening || this.isVibrating) {
                    this.stopDetection();
                }
            });
        });

        // Start listening button
        this.startListeningBtn.addEventListener('click', () => {
            if (this.isListening || this.isVibrating) {
                this.stopDetection();
            } else {
                this.startDetection();
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
        if (mode !== 'auto' && (this.isListening || this.isVibrating)) {
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
        if (this.autoModeType === 'listen') {
            await this.startListening();
        } else if (this.autoModeType === 'vibrate') {
            await this.startVibrating();
        }
    }

    stopDetection() {
        if (this.isListening) {
            this.stopListening();
        } else if (this.isVibrating) {
            this.stopVibrating();
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

    async startListening() {
        try {
            // Check if mediaDevices API is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert('Your browser does not support microphone access. Please use a modern browser like Chrome, Firefox, Safari, or Edge.');
                return;
            }

            // Check if any audio input devices are available
            // Note: Some browsers may not show device labels until permission is granted,
            // but they will still show the device kind. We check for zero devices which
            // indicates a real hardware issue, not just a permission issue.
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices.filter(device => device.kind === 'audioinput');
                
                if (audioInputs.length === 0) {
                    alert('No microphone detected. Please check:\n\n' +
                          '• Your microphone is properly connected\n' +
                          '• Your microphone is enabled in system settings\n' +
                          '• Your browser has permission to access audio devices at the OS level\n\n' +
                          'Windows: Settings > Privacy > Microphone\n' +
                          'Mac: System Settings > Privacy & Security > Microphone\n' +
                          'Linux: Check PulseAudio/ALSA settings');
                    return;
                }
            } catch (enumError) {
                console.log('Could not enumerate devices:', enumError);
                // Continue anyway - some browsers may restrict enumeration before permission
            }

            // Check current permission state if the API is available
            if (navigator.permissions && navigator.permissions.query) {
                try {
                    const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
                    
                    if (permissionStatus.state === 'denied') {
                        alert('Microphone access was denied. Please allow microphone access in your browser settings:\n\n' +
                              '• Chrome/Edge: Click the lock/info icon in the address bar\n' +
                              '• Firefox: Click the lock icon in the address bar\n' +
                              '• Safari: Go to Settings > Websites > Microphone\n\n' +
                              'You may also need to enable microphone access at the system level:\n' +
                              '• Windows: Settings > Privacy > Microphone\n' +
                              '• Mac: System Settings > Privacy & Security > Microphone\n' +
                              '• Linux: Check PulseAudio/ALSA settings');
                        return;
                    }
                } catch (permError) {
                    // Permission query not supported in this browser, continue with getUserMedia
                    console.log('Permission query not supported:', permError);
                }
            }

            // Request microphone access
            this.autoStatus.textContent = 'Requesting microphone access...';
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
            this.startListeningBtn.textContent = 'Stop';
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
            
            // Reset status
            this.autoStatus.textContent = 'Inactive';
            
            // Provide specific error messages based on error type
            if (error.name === 'NotAllowedError') {
                alert('Microphone access was denied. Please allow microphone access and try again.\n\n' +
                      'To enable microphone access:\n' +
                      '• Chrome/Edge: Click the lock/info icon in the address bar\n' +
                      '• Firefox: Click the lock icon in the address bar\n' +
                      '• Safari: Go to Settings > Websites > Microphone');
            } else if (error.name === 'NotFoundError') {
                alert('No microphone found or microphone cannot be accessed.\n\n' +
                      'Please check:\n' +
                      '• Your microphone is properly connected and powered on\n' +
                      '• Your microphone is not being used by another application\n' +
                      '• Your microphone is enabled in system settings:\n' +
                      '  - Windows: Settings > Privacy > Microphone\n' +
                      '  - Mac: System Settings > Privacy & Security > Microphone\n' +
                      '  - Linux: Check PulseAudio/ALSA settings\n' +
                      '• Your browser has OS-level permission to access the microphone\n' +
                      '• Try restarting your browser after enabling permissions');
            } else if (error.name === 'NotReadableError') {
                alert('Microphone is already in use by another application or cannot be accessed.\n\n' +
                      'Please try:\n' +
                      '• Close other applications that might be using the microphone (Zoom, Skype, Discord, etc.)\n' +
                      '• Close other browser tabs that might be using the microphone\n' +
                      '• Restart your browser\n' +
                      '• Check if your microphone works in other applications');
            } else if (error.name === 'OverconstrainedError') {
                alert('Could not access microphone due to constraints. Please try again.');
            } else if (error.name === 'TypeError') {
                alert('Browser error: Please make sure you are using HTTPS or localhost, as microphone access requires a secure connection.');
            } else {
                alert('Could not access microphone: ' + error.message + '\n\nPlease make sure:\n' +
                      '• You have a microphone connected\n' +
                      '• You are using HTTPS or localhost\n' +
                      '• You grant permission when prompted\n' +
                      '• Your browser and OS allow microphone access');
            }
        }
    }

    stopListening() {
        this.isListening = false;
        this.startListeningBtn.textContent = 'Start';
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

    async startVibrating() {
        try {
            // Check if device motion is supported
            if (!window.DeviceMotionEvent) {
                alert('Device motion is not supported on this device or browser. Please use the "Listen (Microphone)" mode instead.');
                return;
            }

            // Request permission for iOS 13+
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission !== 'granted') {
                    alert('Permission to access device motion was denied. Please enable motion permissions in your browser settings or use the "Listen (Microphone)" mode instead.');
                    return;
                }
            }

            this.isVibrating = true;
            this.startListeningBtn.textContent = 'Stop';
            this.startListeningBtn.classList.add('active');
            this.autoStatus.textContent = 'Detecting motion...';
            this.autoStatus.classList.add('listening');
            
            this.detectedBeats = [];
            this.offBeatCount = 0;
            
            // Start the metronome if not already running
            if (!this.isRunning) {
                this.start();
            }
            
            // Set up motion event listener
            this.motionHandler = (event) => this.handleMotion(event);
            window.addEventListener('devicemotion', this.motionHandler);
            
        } catch (error) {
            console.error('Error accessing device motion:', error);
            alert('Could not access device motion. Please ensure your device has an accelerometer and try again, or use the "Listen (Microphone)" mode instead.');
        }
    }

    stopVibrating() {
        this.isVibrating = false;
        this.startListeningBtn.textContent = 'Start';
        this.startListeningBtn.classList.remove('active');
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
    }

    handleMotion(event) {
        if (!this.isVibrating) return;
        
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
                }
                
                // Check if beat is on time with metronome
                this.checkBeatAccuracy(now);
            }
        }
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
