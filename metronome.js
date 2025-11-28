// Metronome Class
class Metronome {
    constructor() {
        this.bpm = 120;
        this.isRunning = false;
        this.beatDetectionEnabled = false; // Toggle for beat detection
        this.intervalId = null;
        this.audioContext = null;
        this.beatTimes = [];
        this.soundType = 'beep'; // 'beep', 'bass', 'cymbal', 'tock', 'riff4', 'riff8', 'vibrate', 'silent'
        this.beatCount = 0; // For tracking position in drum riffs
        this.sensitivityPercent = 50; // User-facing percentage (0-100)

        // Visual synchronization using requestAnimationFrame
        this.scheduledVisualBeats = [];
        this.rafId = null;
        this.isPulseActive = false;

        // Wake Lock to keep screen on
        this.wakeLock = null;

        // Auto mode properties
        this.isDetecting = false;
        this.detectedBeats = [];
        this.sensitivity = 5;
        this.timingTolerance = 100; // milliseconds tolerance for being "on beat"
        this.bpmTolerance = 5; // BPM tolerance for being "on beat"
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
        this.MIN_SENSITIVITY = 1;

        // Constants for accelerometer beat detection
        this.BASE_ACCELERATION_THRESHOLD = 4; // Increased default for less sensitivity
        this.ACCELERATION_SENSITIVITY_MULTIPLIER = .5; // Adjusted multiplier
        this.MAX_ACCELERATION_DISPLAY = 2; // For visualization scaling
        this.ACCELERATION_HIGH_THRESHOLD = 40; // Percentage for high (orange) color
        this.ACCELERATION_VERY_HIGH_THRESHOLD = 70; // Percentage for very high (red) color

        // Constants for off-beat threshold calculation
        this.BASE_OFF_BEAT_THRESHOLD = 6;
        this.SENSITIVITY_DIVISOR = 2;
        this.consecutiveOffBeatsThreshold = this.BASE_OFF_BEAT_THRESHOLD;
        this.consecutiveOnBeatsNeeded = 6; // Number of consecutive on-beats needed to stop the sound
        this.minimumBeatsToPlay = 4; // Minimum number of beats to play when off beat

        this.initializeUI();
        this.setupEventListeners();
        this.initializeTheme();
        // Initialize sensitivity from percentage
        this.sensitivity = Math.max(1, Math.min(10, Math.round(1 + (this.sensitivityPercent / 100) * 9)));
    }

    initializeTheme() {
        // Load saved theme from localStorage or default to 'default'
        const savedTheme = localStorage.getItem('metronomeTheme') || 'default';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        // Remove all theme classes
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-warm-light', 'theme-warm-dark', 'theme-red', 'theme-pink', 'theme-red-dark', 'theme-pink-dark', 'theme-black', 'theme-blue', 'theme-blue-dark');

        // Add new theme class (if not default)
        if (theme === 'light') {
            document.body.classList.add('theme-light');
        } else if (theme === 'dark') {
            document.body.classList.add('theme-dark');
        } else if (theme === 'warm-light') {
            document.body.classList.add('theme-warm-light');
        } else if (theme === 'warm-dark') {
            document.body.classList.add('theme-warm-dark');
        } else if (theme === 'red') {
            document.body.classList.add('theme-red');
        } else if (theme === 'pink') {
            document.body.classList.add('theme-pink');
        } else if (theme === 'red-dark') {
            document.body.classList.add('theme-red-dark');
        } else if (theme === 'pink-dark') {
            document.body.classList.add('theme-pink-dark');
        } else if (theme === 'black') {
            document.body.classList.add('theme-black');
        } else if (theme === 'blue') {
            document.body.classList.add('theme-blue');
        } else if (theme === 'blue-dark') {
            document.body.classList.add('theme-blue-dark');
        }

        // Update active button class in dropdown
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.theme === theme) {
                btn.classList.add('active');
            }
        });

        // Update the main theme button to reflect current theme
        this.themeBtnActive.className = `theme-btn-active theme-${theme}`;

        // Save to localStorage
        localStorage.setItem('metronomeTheme', theme);
    }

    initializeUI() {
        // DOM elements
        this.bpmSlider = document.getElementById('bpmSlider');
        this.bpmValue = document.getElementById('bpmValue');
        this.bpmDisplay = document.getElementById('bpmDisplay');
        this.bpmPresetMenu = document.getElementById('bpmPresetMenu');
        this.startStopBtn = document.getElementById('startStop');
        this.pulseElement = document.getElementById('pulse');
        this.accelerationBar = document.getElementById('accelerationBar');
        this.accelerationMeter = this.accelerationBar.parentElement;
        this.soundSelector = document.getElementById('soundSelector');

        // Theme elements
        this.themeBtnActive = document.querySelector('.theme-btn-active');
        this.themeDropdown = document.querySelector('.theme-dropdown');

        // Beat info displays at the top
        this.beatInfo = document.querySelector('.beat-info');
        this.beatStatusTop = document.getElementById('beatStatus');
        this.beatDetectedBpmTop = document.getElementById('beatDetectedBpm');
        this.beatAccuracyTopDisplay = document.getElementById('beatAccuracyTop');

        // Beat detection toggle
        this.beatDetectionToggle = document.getElementById('beatDetectionToggle');

        // Auto mode elements
        this.autoModeSettings = document.getElementById('autoModeSettings');
        this.sensitivitySlider = document.getElementById('sensitivitySlider');
        this.sensitivityValue = document.getElementById('sensitivityValue');
        this.toleranceSlider = document.getElementById('toleranceSlider');
        this.toleranceValue = document.getElementById('toleranceValue');
        this.bpmToleranceSlider = document.getElementById('bpmToleranceSlider');
        this.bpmToleranceValue = document.getElementById('bpmToleranceValue');
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

        // BPM display click - toggle preset menu
        this.bpmDisplay.addEventListener('click', () => {
            const isVisible = this.bpmPresetMenu.style.display === 'block';
            this.bpmPresetMenu.style.display = isVisible ? 'none' : 'block';
        });

        // BPM preset buttons
        const presetButtons = document.querySelectorAll('.bpm-preset-btn');
        presetButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newBpm = parseInt(e.target.dataset.bpm);
                this.bpm = newBpm;
                this.bpmValue.textContent = this.bpm;
                this.bpmSlider.value = this.bpm;
                this.bpmPresetMenu.style.display = 'none';
                if (this.isRunning) {
                    this.stop();
                    this.start();
                }
            });
        });

        // Close preset menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.bpmDisplay.contains(e.target) && !this.bpmPresetMenu.contains(e.target)) {
                this.bpmPresetMenu.style.display = 'none';
            }
        });

        // Start/Stop button
        this.startStopBtn.addEventListener('click', () => {
            if (this.isRunning) {
                this.stop();
                // Also stop detection if enabled
                if (this.beatDetectionEnabled && this.isDetecting) {
                    this.stopDetection();
                }
            } else {
                this.start();
                // Auto-start detection if beat detection is enabled
                if (this.beatDetectionEnabled) {
                    this.startDetection();
                }
            }
        });

        // Sound selector
        this.soundSelector.addEventListener('change', (e) => {
            this.soundType = e.target.value;
            this.beatCount = 0; // Reset beat counter when changing sounds
        });

        // Beat detection toggle
        this.beatDetectionToggle.addEventListener('change', (e) => {
            this.beatDetectionEnabled = e.target.checked;
            if (this.beatDetectionEnabled) {
                this.autoModeSettings.style.display = 'block';
                this.beatInfo.style.display = 'flex';
                // Auto-start detection if metronome is running
                if (this.isRunning && !this.isDetecting) {
                    this.startDetection();
                }
            } else {
                this.autoModeSettings.style.display = 'none';
                this.beatInfo.style.display = 'none';
                // Stop detection if currently detecting
                if (this.isDetecting) {
                    this.stopDetection();
                }
            }
        });

        // Sensitivity slider - for beat detection threshold
        this.sensitivitySlider.addEventListener('input', (e) => {
            this.sensitivityPercent = parseInt(e.target.value);
            this.sensitivityValue.textContent = this.sensitivityPercent;
            // Convert percentage (0-100) to internal scale (1-10)
            // 0% = 1 (least sensitive), 100% = 10 (most sensitive)
            this.sensitivity = Math.max(1, Math.min(10, Math.round(1 + (this.sensitivityPercent / 100) * 9)));
        });

        // Tolerance slider - for timing tolerance (how far off beat is acceptable)
        this.toleranceSlider.addEventListener('input', (e) => {
            this.timingTolerance = parseInt(e.target.value);
            this.toleranceValue.textContent = this.timingTolerance;
            // Higher tolerance = more consecutive off-beats needed to trigger alert
            this.consecutiveOffBeatsThreshold = Math.max(1, this.BASE_OFF_BEAT_THRESHOLD - Math.floor(this.timingTolerance / 200));
        });

        // BPM Tolerance slider
        this.bpmToleranceSlider.addEventListener('input', (e) => {
            this.bpmTolerance = parseInt(e.target.value);
            this.bpmToleranceValue.textContent = this.bpmTolerance;
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

        // Theme switcher - toggle dropdown
        this.themeBtnActive.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = this.themeDropdown.style.display === 'grid';
            this.themeDropdown.style.display = isVisible ? 'none' : 'grid';
        });

        // Theme selection from dropdown
        document.querySelectorAll('.theme-dropdown .theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setTheme(btn.dataset.theme);
                this.themeDropdown.style.display = 'none';
            });
        });

        // Close theme dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.themeBtnActive.contains(e.target) && !this.themeDropdown.contains(e.target)) {
                this.themeDropdown.style.display = 'none';
            }
        });

        // Click on acceleration meter to toggle beat detection
        const toggleMode = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.beatDetectionToggle.checked = !this.beatDetectionToggle.checked;
            // Trigger change event
            this.beatDetectionToggle.dispatchEvent(new Event('change'));
        };

        this.accelerationMeter.addEventListener('touchend', toggleMode);
        this.accelerationMeter.addEventListener('click', toggleMode);

        // Click on pulse (metronome indicator) to start/stop
        const toggleMetronome = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.isRunning) {
                this.stop();
                // Also stop detection if enabled
                if (this.beatDetectionEnabled && this.isDetecting) {
                    this.stopDetection();
                }
            } else {
                this.start();
                // Auto-start detection if beat detection is enabled
                if (this.beatDetectionEnabled) {
                    this.startDetection();
                }
            }
        };

        this.pulseElement.addEventListener('touchend', toggleMetronome);
        this.pulseElement.addEventListener('click', toggleMetronome);
    } start() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        this.isRunning = true;
        this.startStopBtn.textContent = 'Stop';
        this.startStopBtn.classList.add('active');
        this.beatTimes = [];
        this.beatCount = 0; // Reset beat counter
        this.scheduledVisualBeats = [];

        // Initialize timing for precise audio sync
        this.nextBeatTime = this.audioContext.currentTime;
        this.scheduleAheadTime = 0.1; // Schedule 100ms ahead
        this.schedulerInterval = 25; // Check every 25ms

        this.scheduleBeat();
        // Start scheduler loop for audio
        this.intervalId = setInterval(() => this.scheduleBeat(), this.schedulerInterval);

        // Start RAF loop for visual synchronization
        this.startVisualLoop();

        // Request wake lock to keep screen on
        this.requestWakeLock();
    }

    stop() {
        this.isRunning = false;
        this.startStopBtn.textContent = 'Start';
        this.startStopBtn.classList.remove('active');

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        this.scheduledVisualBeats = [];
        if (this.isPulseActive) {
            this.pulseElement.classList.remove('active');
            this.isPulseActive = false;
        }

        // Release wake lock
        this.releaseWakeLock();
    }

    async requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake Lock active');

                // Re-acquire wake lock if page becomes visible again
                this.wakeLock.addEventListener('release', () => {
                    console.log('Wake Lock released');
                });
            }
        } catch (err) {
            console.error(`Wake Lock error: ${err.name}, ${err.message}`);
        }
    }

    releaseWakeLock() {
        if (this.wakeLock !== null) {
            this.wakeLock.release()
                .then(() => {
                    this.wakeLock = null;
                })
                .catch((err) => {
                    console.error(`Wake Lock release error: ${err.name}, ${err.message}`);
                });
        }
    }

    startVisualLoop() {
        const checkVisuals = () => {
            if (!this.isRunning) return;

            const currentTime = this.audioContext.currentTime;

            // Check if any scheduled beats should trigger now
            while (this.scheduledVisualBeats.length > 0 && this.scheduledVisualBeats[0].time <= currentTime) {
                const beat = this.scheduledVisualBeats.shift();

                // Trigger visual pulse
                this.pulseElement.classList.add('active');
                this.isPulseActive = true;

                // Schedule pulse removal
                setTimeout(() => {
                    this.pulseElement.classList.remove('active');
                    this.isPulseActive = false;
                }, 100);

                // Store beat time for auto mode
                this.lastBeatTime = Date.now();
                this.beatTimes.push(this.lastBeatTime);
                if (this.beatTimes.length > 10) {
                    this.beatTimes.shift();
                }
            }

            this.rafId = requestAnimationFrame(checkVisuals);
        };

        checkVisuals();
    }

    scheduleBeat() {
        if (!this.isRunning) return;

        const beatInterval = 60 / this.bpm; // Beat interval in seconds

        // Schedule all beats that need to play in the next scheduleAheadTime window
        while (this.nextBeatTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this.playBeat(this.nextBeatTime);
            this.nextBeatTime += beatInterval;
        }
    }

    playBeat(time) {
        // Schedule visual beat to be triggered by RAF loop
        this.scheduledVisualBeats.push({ time: time });

        // Increment beat counter for riffs
        this.beatCount++;

        // Play sound based on settings
        if (this.soundType === 'silent') {
            // Silent mode: no sound
            return;
        }

        if (this.beatDetectionEnabled) {
            // In beat detection mode, only play if user is off-beat
            if (this.offBeatCount >= this.consecutiveOffBeatsThreshold) {
                this.playSound(time);
            }
        } else {
            // Regular mode: always play sound
            this.playSound(time);
        }
    }

    playSound(time) {
        if (!this.audioContext) return;

        switch (this.soundType) {
            case 'beep':
                this.playBeep(time);
                break;
            case 'bass':
                this.playBassDrum(time);
                break;
            case 'cymbal':
                this.playCymbal(time);
                break;
            case 'tock':
                this.playTock(time);
                break;
            case 'riff4':
                this.playDrumRiff(4, time);
                break;
            case 'riff8':
                this.playDrumRiff(8, time);
                break;
            case 'vibrate':
                this.playVibrate(time);
                break;
            default:
                this.playBeep(time);
        }
    }

    playBeep(time) {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        oscillator.frequency.value = 1000; // 1000 Hz beep
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, time);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        oscillator.start(time);
        oscillator.stop(time + 0.1);
    }

    playVibrate(time) {
        // Check if audioContext exists for timing calculation
        if (!this.audioContext) return;

        // Calculate delay from scheduled time to now
        const delay = Math.max(0, (time - this.audioContext.currentTime) * 1000);

        // Schedule the vibration to occur at the right time
        setTimeout(() => {
            if ('vibrate' in navigator) {
                navigator.vibrate(100); // Vibrate for 100ms
            }
        }, delay);
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
            this.autoStatus.textContent = 'Detecting taps...';
            this.autoStatus.classList.add('listening');

            this.detectedBeats = [];
            this.offBeatCount = 0;

            // Initialize top displays
            this.beatStatusTop.textContent = 'Detecting taps...';
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

    playBassDrum(time) {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Bass drum: low frequency with quick pitch drop
        oscillator.frequency.setValueAtTime(200, time);
        oscillator.frequency.exponentialRampToValueAtTime(80, time + 0.1);
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(1.0, time);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

        oscillator.start(time);
        oscillator.stop(time + 0.2);
    }

    playCymbal(time) {
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

        gainNode.gain.setValueAtTime(0.3, time);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

        noise.start(time);
        noise.stop(time + 0.3);
    }

    playTock(time) {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Tock: woody sound - lower frequency square wave
        oscillator.frequency.value = 800;
        oscillator.type = 'square';

        gainNode.gain.setValueAtTime(0.15, time);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

        oscillator.start(time);
        oscillator.stop(time + 0.05);
    }

    playDrumRiff(count, time) {
        if (!this.audioContext) return;

        // Calculate position in the riff pattern (1-based)
        const position = ((this.beatCount - 1) % count) + 1;

        if (count === 4) {
            // 4-count pattern: Bass on 1, 2, 3; Cymbal on 4
            if (position === 4) {
                this.playCymbal(time);
            } else {
                this.playBassDrum(time);
            }
        } else if (count === 8) {
            // 8-count pattern: "bum bum chish de de bum bum chish"
            // Beat: 1=bum, 2=bum, 3=chish, 4=de+de, 5=bum, 6=bum, 7=chish, 8=rest
            const beatInterval = 60 / this.bpm; // in seconds
            const eighthNote = beatInterval / 2;

            if (position === 1 || position === 2 || position === 5 || position === 6) {
                // Quarter note bass (bum)
                this.playBassDrum(time);
            } else if (position === 3 || position === 7) {
                // Quarter note cymbal (chish)
                this.playCymbal(time);
            } else if (position === 4) {
                // Two eighth note bass hits (de de)
                this.playBassDrum(time);
                this.playBassDrum(time + eighthNote);
            }
            // position 8 is rest (no sound)
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
        // Higher sensitivity number = lower threshold (easier to detect)
        const threshold = this.BASE_ACCELERATION_THRESHOLD - ((this.sensitivity - this.MIN_SENSITIVITY) * this.ACCELERATION_SENSITIVITY_MULTIPLIER);

        if (accelerationChange > threshold) {
            const now = Date.now();

            // Avoid detecting the same beat multiple times
            if (this.detectedBeats.length === 0 || (now - this.detectedBeats[this.detectedBeats.length - 1]) > this.BEAT_DEBOUNCE_MS) {
                this.detectedBeats.push(now);

                // Flash the acceleration meter to show beat detected
                this.flashBeatDetected();

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
        // Use the timing tolerance slider value directly (in milliseconds)
        const tolerance = this.timingTolerance;

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

        // Check if beat is within timing tolerance
        const isTimingOnBeat = closestDiff < tolerance;

        // Check if BPM is within tolerance
        const bpmDiff = this.detectedBPM ? Math.abs(this.detectedBPM - this.bpm) : 0;
        const isBpmOnBeat = bpmDiff <= this.bpmTolerance;

        // Must be within both timing AND BPM tolerance to be on beat
        const isOnBeat = isTimingOnBeat && isBpmOnBeat;

        if (isOnBeat) {
            this.offBeatCount = Math.max(0, this.offBeatCount - 1);
            const msOff = Math.round(closestDiff);
            const bpmDiff = this.detectedBPM ? Math.abs(this.detectedBPM - this.bpm) : 0;
            this.beatAccuracy.textContent = `On beat - ${msOff}ms, ${bpmDiff.toFixed(1)} BPM off`;
            this.beatAccuracyTopDisplay.textContent = `${msOff}ms`;
            this.autoStatus.textContent = 'On beat';
            this.autoStatus.classList.remove('alert');
            this.autoStatus.classList.add('listening');
            this.beatStatusTop.textContent = 'On beat';
            this.beatStatusTop.className = 'beat-info-value status-listening';
        } else {
            this.offBeatCount++;
            const msOff = Math.round(closestDiff);
            const bpmDiff = this.detectedBPM ? Math.abs(this.detectedBPM - this.bpm) : 0;
            let reason = '';
            if (!isTimingOnBeat && !isBpmOnBeat) {
                reason = 'timing & BPM';
            } else if (!isTimingOnBeat) {
                reason = 'timing';
            } else {
                reason = 'BPM';
            }
            this.beatAccuracy.textContent = `Off beat (${reason}) - ${msOff}ms, ${bpmDiff.toFixed(1)} BPM off`;
            this.beatAccuracyTopDisplay.textContent = `${msOff}ms`;

            if (this.offBeatCount >= this.consecutiveOffBeatsThreshold) {
                // Cap offBeatCount so it doesn't require too many on-beats to recover
                this.offBeatCount = Math.min(this.offBeatCount, this.consecutiveOffBeatsThreshold + this.consecutiveOnBeatsNeeded - 1);

                this.autoStatus.textContent = 'Off beat - Beeping!';
                this.autoStatus.classList.remove('listening');
                this.autoStatus.classList.add('alert');
                this.beatStatusTop.textContent = 'Off beat!';
                this.beatStatusTop.className = 'beat-info-value status-alert';
            }
        }
    }

    flashBeatDetected() {
        // Add beat-detected class to acceleration meter
        this.accelerationMeter.classList.add('beat-detected');
        setTimeout(() => {
            this.accelerationMeter.classList.remove('beat-detected');
        }, 150);
    }
}

// Initialize metronome when page loads
document.addEventListener('DOMContentLoaded', () => {
    const metronome = new Metronome();
});
