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

        // Activity log
        this.activityLog = [];
        this.loadActivityLog();

        // Session statistics tracking
        this.sessionStats = {
            bpmReadings: [],        // Array of {timestamp, bpm} for charting
            currentStreak: 0,       // Current consecutive on-beat count
            bestSessionStreak: 0,   // Best streak in current session
            totalBeats: 0,          // Total beats detected in session
            onBeatCount: 0,         // Total on-beat hits
            sessionStartTime: null  // When current session started
        };
        this.allTimeStats = {
            bestStreak: 0,
            totalPracticeTime: 0,   // Total practice time in milliseconds
            totalSessions: 0,
            totalBeats: 0,
            totalOnBeats: 0,
            averageAccuracy: 0,
            sessions: []            // Historical session data for charts
        };
        this.loadAllTimeStats();

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

        // Log modal elements
        this.logBtn = document.getElementById('logBtn');
        this.logModal = document.getElementById('logModal');
        this.closeLogBtn = document.getElementById('closeLogBtn');
        this.clearLogBtn = document.getElementById('clearLogBtn');
        this.logEntries = document.getElementById('logEntries');

        // Stats modal elements
        this.statsBtn = document.getElementById('statsBtn');
        this.statsModal = document.getElementById('statsModal');
        this.closeStatsBtn = document.getElementById('closeStatsBtn');
        this.bpmChart = document.getElementById('bpmChart');
        this.currentStreakDisplay = document.getElementById('currentStreak');
        this.bestStreakDisplay = document.getElementById('bestStreak');
        this.sessionAccuracyDisplay = document.getElementById('sessionAccuracy');
        this.allTimeBestDisplay = document.getElementById('allTimeBest');
        this.totalPracticeDisplay = document.getElementById('totalPractice');
        this.totalSessionsDisplay = document.getElementById('totalSessions');
        this.clearStatsBtn = document.getElementById('clearStatsBtn');
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

        // Log button
        this.logBtn.addEventListener('click', () => {
            this.displayActivityLog();
            this.logModal.style.display = 'flex';
        });

        // Close log modal
        this.closeLogBtn.addEventListener('click', () => {
            this.logModal.style.display = 'none';
        });

        // Close log modal when clicking outside
        this.logModal.addEventListener('click', (e) => {
            if (e.target === this.logModal) {
                this.logModal.style.display = 'none';
            }
        });

        // Clear all logs button
        this.clearLogBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete all activity logs? This cannot be undone.')) {
                this.activityLog = [];
                this.saveActivityLog();
                this.displayActivityLog();
            }
        });

        // Stats button
        this.statsBtn.addEventListener('click', () => {
            this.displayStats();
            this.statsModal.style.display = 'flex';
        });

        // Close stats modal
        this.closeStatsBtn.addEventListener('click', () => {
            this.statsModal.style.display = 'none';
        });

        // Close stats modal when clicking outside
        this.statsModal.addEventListener('click', (e) => {
            if (e.target === this.statsModal) {
                this.statsModal.style.display = 'none';
            }
        });

        // Clear all stats button
        this.clearStatsBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete all statistics? This cannot be undone.')) {
                this.allTimeStats = {
                    bestStreak: 0,
                    totalPracticeTime: 0,
                    totalSessions: 0,
                    totalBeats: 0,
                    totalOnBeats: 0,
                    averageAccuracy: 0,
                    sessions: []
                };
                this.saveAllTimeStats();
                this.displayStats();
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
    }

    start() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        this.isRunning = true;
        this.logActivity('Started');
        this.startStopBtn.textContent = 'Stop';
        // Ensure active class is set
        if (!this.startStopBtn.classList.contains('active')) {
            this.startStopBtn.classList.add('active');
        }
        // Force style update for mobile
        this.startStopBtn.style.background = 'var(--pulse-active)';
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
        this.logActivity('Stopped');
        this.startStopBtn.textContent = 'Start';
        // Ensure active class is removed
        if (this.startStopBtn.classList.contains('active')) {
            this.startStopBtn.classList.remove('active');
        }
        // Force style update for mobile
        this.startStopBtn.style.background = 'var(--primary-color)';

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

            // Initialize session stats
            this.sessionStats = {
                bpmReadings: [],
                currentStreak: 0,
                bestSessionStreak: 0,
                totalBeats: 0,
                onBeatCount: 0,
                sessionStartTime: Date.now()
            };

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
        // Save session stats before stopping
        if (this.sessionStats.sessionStartTime && this.sessionStats.totalBeats > 0) {
            this.saveSessionStats();
        }

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

            // Track session stats - on beat
            this.trackBeatStats(true);
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

            // Track session stats - off beat
            this.trackBeatStats(false);

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

    logActivity(action) {
        const entry = {
            action: action,
            timestamp: Date.now()
        };
        this.activityLog.push(entry);
        this.saveActivityLog();
    }

    saveActivityLog() {
        try {
            localStorage.setItem('metronomeActivityLog', JSON.stringify(this.activityLog));
        } catch (e) {
            console.error('Failed to save activity log:', e);
        }
    }

    loadActivityLog() {
        try {
            const saved = localStorage.getItem('metronomeActivityLog');
            if (saved) {
                this.activityLog = JSON.parse(saved);
            }
        } catch (e) {
            console.error('Failed to load activity log:', e);
            this.activityLog = [];
        }
    }

    formatDateTime(timestamp) {
        const date = new Date(timestamp);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 should be 12
        const hoursStr = String(hours).padStart(2, '0');
        return `${month}/${day}/${year} ${hoursStr}:${minutes}:${seconds} ${ampm}`;
    }

    displayActivityLog() {
        this.logEntries.innerHTML = '';

        if (this.activityLog.length === 0) {
            this.logEntries.innerHTML = '<div class="log-empty">No activity logged yet</div>';
            return;
        }

        // Group logs into practice sessions
        const sessions = this.groupIntoSessions([...this.activityLog].reverse());

        sessions.forEach(session => {
            // Create session header
            const sessionHeader = document.createElement('div');
            sessionHeader.className = 'log-session-header';

            const sessionInfo = document.createElement('div');
            sessionInfo.className = 'log-session-info';

            const dateSpan = document.createElement('span');
            dateSpan.className = 'log-session-date';
            dateSpan.textContent = this.formatDate(session.date);

            const durationSpan = document.createElement('span');
            durationSpan.className = 'log-session-duration';
            durationSpan.textContent = session.duration;

            sessionInfo.appendChild(dateSpan);
            sessionInfo.appendChild(durationSpan);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-session-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.title = 'Delete this session';
            deleteBtn.addEventListener('click', () => {
                if (confirm('Delete this practice session?')) {
                    this.deleteSession(session);
                }
            });

            sessionHeader.appendChild(sessionInfo);
            sessionHeader.appendChild(deleteBtn);
            this.logEntries.appendChild(sessionHeader);

            // Create session entries
            const sessionEntries = document.createElement('div');
            sessionEntries.className = 'log-session-entries';

            session.entries.forEach(entry => {
                const logEntry = document.createElement('div');
                logEntry.className = 'log-entry';

                const actionSpan = document.createElement('span');
                actionSpan.className = `log-action log-action-${entry.action.toLowerCase()}`;
                actionSpan.textContent = entry.action;

                const timeSpan = document.createElement('span');
                timeSpan.className = 'log-time';
                timeSpan.textContent = this.formatTime(entry.timestamp);

                logEntry.appendChild(actionSpan);
                logEntry.appendChild(timeSpan);
                sessionEntries.appendChild(logEntry);
            });

            this.logEntries.appendChild(sessionEntries);
        });
    }

    groupIntoSessions(reversedLog) {
        if (reversedLog.length === 0) return [];

        const sessions = [];
        let currentSession = null;
        const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes gap indicates new session

        reversedLog.forEach((entry, index) => {
            const entryDate = new Date(entry.timestamp);
            const dateKey = entryDate.toDateString();

            // Check if we need a new session
            if (!currentSession ||
                currentSession.dateKey !== dateKey ||
                (index > 0 && entry.timestamp - reversedLog[index - 1].timestamp > SESSION_GAP_MS)) {

                if (currentSession) {
                    sessions.push(currentSession);
                }

                currentSession = {
                    dateKey: dateKey,
                    date: entry.timestamp,
                    entries: [],
                    startTime: null,
                    endTime: null
                };
            }

            currentSession.entries.push(entry);

            // Track start and end times for duration calculation
            if (entry.action === 'Started') {
                if (!currentSession.startTime) {
                    currentSession.startTime = entry.timestamp;
                }
            } else if (entry.action === 'Stopped') {
                currentSession.endTime = entry.timestamp;
            }
        });

        if (currentSession) {
            sessions.push(currentSession);
        }

        // Calculate durations
        sessions.forEach(session => {
            if (session.startTime && session.endTime) {
                const durationMs = session.endTime - session.startTime;
                session.duration = this.formatDuration(durationMs);
            } else if (session.startTime) {
                session.duration = 'In progress';
            } else {
                session.duration = '--';
            }
        });

        return sessions;
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const dateStr = date.toDateString();
        const todayStr = today.toDateString();
        const yesterdayStr = yesterday.toDateString();

        if (dateStr === todayStr) {
            return 'Today';
        } else if (dateStr === yesterdayStr) {
            return 'Yesterday';
        } else {
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const year = date.getFullYear();
            return `${month}/${day}/${year}`;
        }
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const hoursStr = String(hours).padStart(2, '0');
        return `${hoursStr}:${minutes}:${seconds} ${ampm}`;
    }

    formatDuration(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
        }
    }

    deleteSession(session) {
        // Remove all entries from this session
        const timestampsToRemove = new Set(session.entries.map(e => e.timestamp));
        this.activityLog = this.activityLog.filter(entry => !timestampsToRemove.has(entry.timestamp));
        this.saveActivityLog();
        this.displayActivityLog();
    }

    // Statistics Methods
    trackBeatStats(isOnBeat) {
        const now = Date.now();

        // Track total beats
        this.sessionStats.totalBeats++;

        if (isOnBeat) {
            this.sessionStats.onBeatCount++;
            this.sessionStats.currentStreak++;

            // Update best session streak
            if (this.sessionStats.currentStreak > this.sessionStats.bestSessionStreak) {
                this.sessionStats.bestSessionStreak = this.sessionStats.currentStreak;
            }

            // Update all-time best streak
            if (this.sessionStats.currentStreak > this.allTimeStats.bestStreak) {
                this.allTimeStats.bestStreak = this.sessionStats.currentStreak;
                this.saveAllTimeStats();
            }
        } else {
            // Reset current streak on off-beat
            this.sessionStats.currentStreak = 0;
        }

        // Record BPM reading if we have detected BPM
        if (this.detectedBPM) {
            this.sessionStats.bpmReadings.push({
                timestamp: now,
                bpm: this.detectedBPM,
                targetBpm: this.bpm,
                isOnBeat: isOnBeat
            });

            // Keep only last 100 readings to prevent memory issues
            if (this.sessionStats.bpmReadings.length > 100) {
                this.sessionStats.bpmReadings.shift();
            }
        }
    }

    saveSessionStats() {
        const sessionEndTime = Date.now();
        const sessionDuration = sessionEndTime - this.sessionStats.sessionStartTime;

        // Create session summary
        const sessionSummary = {
            date: this.sessionStats.sessionStartTime,
            duration: sessionDuration,
            targetBpm: this.bpm,
            totalBeats: this.sessionStats.totalBeats,
            onBeatCount: this.sessionStats.onBeatCount,
            accuracy: this.sessionStats.totalBeats > 0 
                ? Math.round((this.sessionStats.onBeatCount / this.sessionStats.totalBeats) * 100) 
                : 0,
            bestStreak: this.sessionStats.bestSessionStreak,
            bpmReadings: this.sessionStats.bpmReadings.slice(-50) // Store last 50 readings per session
        };

        // Update all-time stats
        this.allTimeStats.totalPracticeTime += sessionDuration;
        this.allTimeStats.totalSessions++;
        this.allTimeStats.totalBeats += this.sessionStats.totalBeats;
        this.allTimeStats.totalOnBeats += this.sessionStats.onBeatCount;

        // Calculate average accuracy
        if (this.allTimeStats.totalBeats > 0) {
            this.allTimeStats.averageAccuracy = Math.round(
                (this.allTimeStats.totalOnBeats / this.allTimeStats.totalBeats) * 100
            );
        }

        // Add session to history (keep last 30 sessions)
        this.allTimeStats.sessions.push(sessionSummary);
        if (this.allTimeStats.sessions.length > 30) {
            this.allTimeStats.sessions.shift();
        }

        this.saveAllTimeStats();
    }

    loadAllTimeStats() {
        try {
            const saved = localStorage.getItem('metronomeAllTimeStats');
            if (saved) {
                this.allTimeStats = JSON.parse(saved);
            }
        } catch (e) {
            console.error('Failed to load all-time stats:', e);
            this.allTimeStats = {
                bestStreak: 0,
                totalPracticeTime: 0,
                totalSessions: 0,
                totalBeats: 0,
                totalOnBeats: 0,
                averageAccuracy: 0,
                sessions: []
            };
        }
    }

    saveAllTimeStats() {
        try {
            localStorage.setItem('metronomeAllTimeStats', JSON.stringify(this.allTimeStats));
        } catch (e) {
            console.error('Failed to save all-time stats:', e);
        }
    }

    displayStats() {
        // Update current session stats
        if (this.currentStreakDisplay) {
            this.currentStreakDisplay.textContent = this.sessionStats.currentStreak || 0;
        }
        if (this.bestStreakDisplay) {
            this.bestStreakDisplay.textContent = this.sessionStats.bestSessionStreak || 0;
        }
        if (this.sessionAccuracyDisplay) {
            const accuracy = this.sessionStats.totalBeats > 0
                ? Math.round((this.sessionStats.onBeatCount / this.sessionStats.totalBeats) * 100)
                : 0;
            this.sessionAccuracyDisplay.textContent = `${accuracy}%`;
        }

        // Update all-time stats
        if (this.allTimeBestDisplay) {
            this.allTimeBestDisplay.textContent = this.allTimeStats.bestStreak || 0;
        }
        if (this.totalPracticeDisplay) {
            this.totalPracticeDisplay.textContent = this.formatDuration(this.allTimeStats.totalPracticeTime || 0);
        }
        if (this.totalSessionsDisplay) {
            this.totalSessionsDisplay.textContent = this.allTimeStats.totalSessions || 0;
        }

        // Draw BPM chart
        this.drawBpmChart();

        // Display achievements
        this.displayAchievements();
    }

    drawBpmChart() {
        const canvas = this.bpmChart;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Get data - combine current session with recent session history
        let readings = [...this.sessionStats.bpmReadings];
        
        // If no current readings, try to use last session's data
        if (readings.length === 0 && this.allTimeStats.sessions.length > 0) {
            const lastSession = this.allTimeStats.sessions[this.allTimeStats.sessions.length - 1];
            readings = lastSession.bpmReadings || [];
        }

        if (readings.length < 2) {
            // Show placeholder text
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-tertiary') || '#666';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Start beat detection to see your BPM chart', width / 2, height / 2);
            return;
        }

        // Chart settings
        const padding = { top: 20, right: 20, bottom: 30, left: 40 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Find min/max BPM for scaling
        const bpms = readings.map(r => r.bpm);
        const targetBpm = readings[0].targetBpm || this.bpm;
        let minBpm = Math.min(...bpms, targetBpm) - 10;
        let maxBpm = Math.max(...bpms, targetBpm) + 10;

        // Prevent division by zero when all BPM values are the same
        if (maxBpm === minBpm) {
            minBpm -= 10;
            maxBpm += 10;
        }
        const bpmRange = maxBpm - minBpm;

        // Draw grid lines
        ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--border-color') || '#e0e0e0';
        ctx.lineWidth = 1;

        // Horizontal grid lines
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (chartHeight / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();
        }

        // Draw target BPM line
        const targetY = padding.top + chartHeight - ((targetBpm - minBpm) / bpmRange) * chartHeight;
        ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--primary-color') || '#667eea';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(padding.left, targetY);
        ctx.lineTo(width - padding.right, targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw BPM line
        ctx.beginPath();
        ctx.strokeStyle = '#48bb78'; // Green for on-beat readings
        ctx.lineWidth = 2;

        // Calculate x step - handle edge case where readings.length could be 1
        const xDivisor = Math.max(1, readings.length - 1);

        readings.forEach((reading, index) => {
            const x = padding.left + (index / xDivisor) * chartWidth;
            const y = padding.top + chartHeight - ((reading.bpm - minBpm) / bpmRange) * chartHeight;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Draw points with color based on on-beat status
        readings.forEach((reading, index) => {
            const x = padding.left + (index / xDivisor) * chartWidth;
            const y = padding.top + chartHeight - ((reading.bpm - minBpm) / bpmRange) * chartHeight;

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = reading.isOnBeat ? '#48bb78' : '#e53e3e';
            ctx.fill();
        });

        // Draw labels
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-secondary') || '#666';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';

        // Y-axis labels
        for (let i = 0; i <= 4; i++) {
            const bpm = minBpm + (bpmRange / 4) * (4 - i);
            const y = padding.top + (chartHeight / 4) * i;
            ctx.fillText(Math.round(bpm).toString(), padding.left - 5, y + 4);
        }

        // X-axis label
        ctx.textAlign = 'center';
        ctx.fillText('Time →', width / 2, height - 5);

        // Target BPM label
        ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--primary-color') || '#667eea';
        ctx.textAlign = 'left';
        ctx.fillText(`Target: ${targetBpm}`, padding.left + 5, targetY - 5);
    }

    displayAchievements() {
        const achievementsContainer = document.getElementById('achievementsList');
        if (!achievementsContainer) return;

        const achievements = this.calculateAchievements();
        
        achievementsContainer.innerHTML = achievements.map(achievement => `
            <div class="achievement-item ${achievement.unlocked ? 'unlocked' : 'locked'}">
                <span class="achievement-icon">${achievement.icon}</span>
                <div class="achievement-info">
                    <span class="achievement-name">${achievement.name}</span>
                    <span class="achievement-desc">${achievement.description}</span>
                </div>
                ${achievement.unlocked ? '<span class="achievement-check">✓</span>' : ''}
            </div>
        `).join('');
    }

    calculateAchievements() {
        const stats = this.allTimeStats;

        return [
            {
                name: 'First Beat',
                description: 'Complete your first beat detection session',
                icon: '🎵',
                unlocked: stats.totalSessions >= 1
            },
            {
                name: 'Practice Makes Perfect',
                description: 'Complete 10 practice sessions',
                icon: '📚',
                unlocked: stats.totalSessions >= 10
            },
            {
                name: 'Streak Starter',
                description: 'Get a 10-beat on-beat streak',
                icon: '🔥',
                unlocked: stats.bestStreak >= 10
            },
            {
                name: 'Rhythm Master',
                description: 'Get a 25-beat on-beat streak',
                icon: '⭐',
                unlocked: stats.bestStreak >= 25
            },
            {
                name: 'Metronome Pro',
                description: 'Get a 50-beat on-beat streak',
                icon: '🏆',
                unlocked: stats.bestStreak >= 50
            },
            {
                name: 'Dedicated Musician',
                description: 'Practice for 30 minutes total',
                icon: '⏰',
                unlocked: stats.totalPracticeTime >= 30 * 60 * 1000
            },
            {
                name: 'Hour of Power',
                description: 'Practice for 1 hour total',
                icon: '💪',
                unlocked: stats.totalPracticeTime >= 60 * 60 * 1000
            },
            {
                name: 'Beat Machine',
                description: 'Detect 500 beats total',
                icon: '🥁',
                unlocked: stats.totalBeats >= 500
            }
        ];
    }
}

// Initialize metronome when page loads
document.addEventListener('DOMContentLoaded', () => {
    const metronome = new Metronome();
});
