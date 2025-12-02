// Drum Pad Application
class DrumPad {
    // Audio effect constants
    static REVERB_DURATION = 2; // seconds
    static DISTORTION_AMOUNT = 50;
    static WAVE_SHAPER_SAMPLES = 44100;
    static STORAGE_KEY = 'drumPadBeats';
    static SAMPLES_STORAGE_KEY = 'drumPadSamples';
    static RECORDING_BUFFER_MS = 200; // Buffer added to raw recordings for looping

    constructor() {
        this.audioContext = null;
        this.modifiers = {
            reverb: false,
            distortion: false,
            pitchUp: false,
            pitchDown: false
        };

        // Reverb convolver
        this.convolverNode = null;
        this.reverbBuffer = null;

        // Track mouse button state for drag support
        this.isMouseDown = false;

        // Track which pad each touch is currently over (touchId -> pad element)
        this.touchPadMap = new Map();

        // Recording state
        this.isRecording = false;
        this.recordingStartTime = 0;
        this.recordedEvents = [];

        // Saved beats
        this.savedBeats = [];
        this.loadBeats();

        // Playback state - Map of beatIndex -> timeoutIds array for multi-beat playback
        this.playingBeats = new Map();

        // Sample recording state
        this.isSampleRecording = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.customSamples = {}; // Map of soundType -> audio buffer
        this.loadSamples();

        this.initializeUI();
        this.setupEventListeners();
        this.initializeTheme();
        this.renderBeatList();
        this.updatePadSampleIndicators();
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
        // Theme elements
        this.themeBtnActive = document.querySelector('.theme-btn-active');
        this.themeDropdown = document.querySelector('.theme-dropdown');

        // Info modal
        this.infoBtn = document.getElementById('infoBtn');
        this.infoModal = document.getElementById('infoModal');
        this.closeInfoBtn = document.getElementById('closeInfoBtn');

        // Recording controls
        this.recordBtn = document.getElementById('recordBtn');
        this.saveBtn = document.getElementById('saveBtn');
        this.savePlayBtn = document.getElementById('savePlayBtn');
        this.menuBtn = document.getElementById('menuBtn');
        this.menuDropdown = document.getElementById('menuDropdown');
        this.cleanupBtn = document.getElementById('cleanupBtn');

        // Sample button
        this.sampleBtn = document.getElementById('sampleBtn');

        // Beat list
        this.beatList = document.getElementById('beatList');
        this.beatListItems = document.getElementById('beatListItems');
    }

    setupEventListeners() {
        // Theme picker
        this.themeBtnActive.addEventListener('click', (e) => {
            e.stopPropagation();
            this.themeDropdown.classList.toggle('visible');
        });

        document.querySelectorAll('.theme-dropdown .theme-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setTheme(btn.dataset.theme);
                this.themeDropdown.classList.remove('visible');
            });
        });

        document.addEventListener('click', (e) => {
            if (!this.themeBtnActive.contains(e.target) && !this.themeDropdown.contains(e.target)) {
                this.themeDropdown.classList.remove('visible');
            }
        });

        // Drum pad buttons - each plays its own sound
        document.querySelectorAll('.drum-pad').forEach(pad => {
            // Touch events for multi-touch support
            pad.addEventListener('touchstart', (e) => {
                e.preventDefault(); // Prevent mouse events from firing
                // Register this touch with the pad
                for (const touch of e.changedTouches) {
                    this.touchPadMap.set(touch.identifier, pad);
                }
                this.handlePadPress(pad);
            }, { passive: false });

            // Touch end is handled by the global document touchend handler (below)
            // which properly tracks the actual current pad from touchPadMap.

            // Mouse events for desktop
            pad.addEventListener('mousedown', (e) => {
                e.preventDefault();
                this.isMouseDown = true;
                this.handlePadPress(pad);
            });

            pad.addEventListener('mouseup', (e) => {
                this.isMouseDown = false;
                this.handlePadRelease(pad);
            });

            pad.addEventListener('mouseleave', (e) => {
                this.handlePadRelease(pad);
            });

            // Mouse enter for dragging across pads
            pad.addEventListener('mouseenter', (e) => {
                if (this.isMouseDown) {
                    this.handlePadPress(pad);
                }
            });
        });

        // Global mouseup to reset mouse state when released outside pads
        document.addEventListener('mouseup', () => {
            this.isMouseDown = false;
        });

        // Global touchmove handler for dragging across pads
        document.addEventListener('touchmove', (e) => {
            for (const touch of e.changedTouches) {
                const element = document.elementFromPoint(touch.clientX, touch.clientY);
                const pad = element?.closest('.drum-pad');
                const previousPad = this.touchPadMap.get(touch.identifier);

                // Only prevent default if currently on a pad or was on a pad
                // This allows scrolling on other parts of the page
                if (pad || previousPad) {
                    e.preventDefault();
                }

                // If touch moved to a different pad (or no pad)
                if (pad !== previousPad) {
                    // Release the previous pad if there was one
                    if (previousPad) {
                        this.handlePadRelease(previousPad);
                    }

                    // If moved to a new pad, press it
                    if (pad) {
                        this.touchPadMap.set(touch.identifier, pad);
                        this.handlePadPress(pad);
                    } else {
                        // Moved off all pads
                        this.touchPadMap.delete(touch.identifier);
                    }
                }
            }
        }, { passive: false });

        // Global touchend handler to properly release pads when touch ends
        document.addEventListener('touchend', (e) => {
            for (const touch of e.changedTouches) {
                const currentPad = this.touchPadMap.get(touch.identifier);
                if (currentPad) {
                    this.handlePadRelease(currentPad);
                    this.touchPadMap.delete(touch.identifier);
                }
            }
        }, { passive: false });

        // Global touchcancel handler to properly release pads when touch is cancelled
        document.addEventListener('touchcancel', (e) => {
            for (const touch of e.changedTouches) {
                const currentPad = this.touchPadMap.get(touch.identifier);
                if (currentPad) {
                    this.handlePadRelease(currentPad);
                    this.touchPadMap.delete(touch.identifier);
                }
            }
        }, { passive: false });

        // Modifier buttons
        document.querySelectorAll('.modifier-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const modifier = btn.dataset.modifier;

                // Toggle pitch modifiers (only one at a time)
                if (modifier === 'pitch-up' || modifier === 'pitch-down') {
                    const otherPitch = modifier === 'pitch-up' ? 'pitch-down' : 'pitch-up';
                    const otherKey = otherPitch === 'pitch-up' ? 'pitchUp' : 'pitchDown';
                    if (this.modifiers[otherKey]) {
                        this.modifiers[otherKey] = false;
                        document.querySelector(`[data-modifier="${otherPitch}"]`).classList.remove('active');
                    }
                }

                // Convert modifier name to camelCase key (e.g., 'pitch-up' -> 'pitchUp')
                const modKey = modifier === 'pitch-up' ? 'pitchUp' : modifier === 'pitch-down' ? 'pitchDown' : modifier;
                this.modifiers[modKey] = !this.modifiers[modKey];
                btn.classList.toggle('active');
            });
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

        // Recording controls
        this.recordBtn.addEventListener('click', () => {
            this.toggleRecording();
        });

        this.saveBtn.addEventListener('click', () => {
            this.saveBeat(false);
        });

        this.savePlayBtn.addEventListener('click', () => {
            this.saveBeat(true);
        });

        // Sample button
        this.sampleBtn.addEventListener('click', () => {
            this.toggleSampleRecording();
        });

        // Menu
        this.menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.menuDropdown.classList.toggle('visible');
        });

        this.cleanupBtn.addEventListener('click', () => {
            this.cleanupTempo();
            this.menuDropdown.classList.remove('visible');
        });

        document.addEventListener('click', (e) => {
            if (!this.menuBtn.contains(e.target) && !this.menuDropdown.contains(e.target)) {
                this.menuDropdown.classList.remove('visible');
            }
        });
    }

    toggleRecording() {
        if (this.isRecording) {
            // Stop recording
            this.isRecording = false;
            this.recordBtn.classList.remove('recording');
            this.recordBtn.querySelector('.record-label').textContent = 'Record';

            // Hide save buttons if no events recorded
            if (this.recordedEvents.length === 0) {
                this.saveBtn.style.display = 'none';
                this.savePlayBtn.style.display = 'none';
            }
        } else {
            // Start recording
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            this.recordedEvents = [];
            this.recordBtn.classList.add('recording');
            this.recordBtn.querySelector('.record-label').textContent = 'Stop';

            // Show save buttons
            this.saveBtn.style.display = 'flex';
            this.savePlayBtn.style.display = 'flex';
        }
    }

    recordEvent(soundType) {
        if (this.isRecording) {
            const timestamp = Date.now() - this.recordingStartTime;
            this.recordedEvents.push({
                sound: soundType,
                time: timestamp,
                modifiers: { ...this.modifiers }
            });
        }
    }

    saveBeat(playAfterSave) {
        if (this.recordedEvents.length === 0) {
            return;
        }

        // Calculate duration - add a small buffer for looping raw recordings.
        // Use cleanupTempo() from the menu to recalculate proper beat-aligned duration.
        const lastEventTime = this.recordedEvents[this.recordedEvents.length - 1].time;
        const duration = lastEventTime + DrumPad.RECORDING_BUFFER_MS;

        const beat = {
            id: Date.now(),
            name: `Beat ${this.savedBeats.length + 1}`,
            events: [...this.recordedEvents],
            duration: duration,
            repeat: true
        };

        this.savedBeats.push(beat);
        this.saveBeatsToStorage();
        this.renderBeatList();

        // Reset recording state
        this.isRecording = false;
        this.recordBtn.classList.remove('recording');
        this.recordBtn.querySelector('.record-label').textContent = 'Record';
        this.saveBtn.style.display = 'none';
        this.savePlayBtn.style.display = 'none';
        this.recordedEvents = [];

        if (playAfterSave) {
            this.playBeat(this.savedBeats.length - 1);
        }
    }

    // Sample recording methods
    async toggleSampleRecording() {
        if (this.isSampleRecording) {
            this.cancelSampleRecording();
        } else {
            await this.startSampleRecording();
        }
    }

    async startSampleRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            this.isSampleRecording = true;
            this.recordedChunks = [];
            
            this.mediaRecorder = new MediaRecorder(stream);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.start();
            
            // Update UI
            this.sampleBtn.classList.add('recording');
            this.sampleBtn.querySelector('.modifier-label').textContent = 'Cancel';
            document.body.classList.add('sample-save-mode');
            
        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Could not access microphone. Please grant microphone permission.');
        }
    }

    cancelSampleRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            // Stop all tracks to release the microphone
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        
        this.isSampleRecording = false;
        this.recordedChunks = [];
        this.mediaRecorder = null;
        
        // Update UI
        this.sampleBtn.classList.remove('recording');
        this.sampleBtn.querySelector('.modifier-label').textContent = 'Sample';
        document.body.classList.remove('sample-save-mode');
    }

    async saveSampleToPad(soundType) {
        if (!this.isSampleRecording || !this.mediaRecorder) {
            return;
        }

        return new Promise((resolve, reject) => {
            this.mediaRecorder.onstop = async () => {
                // Stop all tracks to release the microphone
                this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
                
                const chunks = this.recordedChunks;
                
                // Update UI 
                this.isSampleRecording = false;
                this.recordedChunks = [];
                this.mediaRecorder = null;
                this.sampleBtn.classList.remove('recording');
                this.sampleBtn.querySelector('.modifier-label').textContent = 'Sample';
                document.body.classList.remove('sample-save-mode');
                
                if (chunks.length > 0) {
                    const blob = new Blob(chunks, { type: 'audio/webm' });
                    
                    // Store the sample as base64 for persistence
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64data = reader.result;
                        this.customSamples[soundType] = base64data;
                        this.saveSamplesToStorage();
                        this.updatePadSampleIndicators();
                        resolve();
                    };
                    reader.onerror = () => {
                        console.error('Error reading audio file');
                        resolve(); // Still resolve to not block the UI
                    };
                    reader.readAsDataURL(blob);
                } else {
                    resolve();
                }
            };
            
            this.mediaRecorder.stop();
        });
    }

    loadSamples() {
        try {
            const stored = localStorage.getItem(DrumPad.SAMPLES_STORAGE_KEY);
            if (stored) {
                this.customSamples = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Error loading samples:', e);
            this.customSamples = {};
        }
    }

    saveSamplesToStorage() {
        try {
            localStorage.setItem(DrumPad.SAMPLES_STORAGE_KEY, JSON.stringify(this.customSamples));
        } catch (e) {
            console.error('Error saving samples:', e);
        }
    }

    updatePadSampleIndicators() {
        document.querySelectorAll('.drum-pad').forEach(pad => {
            const soundType = pad.dataset.sound;
            if (this.customSamples[soundType]) {
                pad.classList.add('has-sample');
            } else {
                pad.classList.remove('has-sample');
            }
        });
    }

    async playCustomSample(soundType) {
        if (!this.customSamples[soundType]) {
            return false;
        }

        this.initAudioContext();

        try {
            // Decode base64 data URL to audio buffer
            const base64data = this.customSamples[soundType];
            
            // Extract the base64 content from the data URL
            const base64Content = base64data.split(',')[1];
            const binaryString = atob(base64Content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const arrayBuffer = bytes.buffer;
            
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            // Create buffer source
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;

            // Create gain node for volume control
            const gainNode = this.audioContext.createGain();
            gainNode.gain.setValueAtTime(0.8, this.audioContext.currentTime);

            // Apply effects chain
            let currentNode = source;

            // Calculate pitch modifier
            if (this.modifiers.pitchUp) {
                source.playbackRate.value = 1.5;
            } else if (this.modifiers.pitchDown) {
                source.playbackRate.value = 0.7;
            }

            // Distortion
            if (this.modifiers.distortion) {
                const distortion = this.createDistortion();
                currentNode.connect(distortion);
                currentNode = distortion;
            }

            // Reverb
            if (this.modifiers.reverb && this.reverbBuffer) {
                const convolver = this.audioContext.createConvolver();
                convolver.buffer = this.reverbBuffer;

                const dryGain = this.audioContext.createGain();
                const wetGain = this.audioContext.createGain();
                dryGain.gain.value = 0.7;
                wetGain.gain.value = 0.5;

                currentNode.connect(dryGain);
                currentNode.connect(convolver);
                convolver.connect(wetGain);

                dryGain.connect(gainNode);
                wetGain.connect(gainNode);
            } else {
                currentNode.connect(gainNode);
            }

            gainNode.connect(this.audioContext.destination);
            source.start();

            return true;
        } catch (e) {
            console.error('Error playing custom sample:', e);
            return false;
        }
    }

    loadBeats() {
        try {
            const stored = localStorage.getItem(DrumPad.STORAGE_KEY);
            if (stored) {
                this.savedBeats = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Error loading beats:', e);
            this.savedBeats = [];
        }
    }

    saveBeatsToStorage() {
        try {
            localStorage.setItem(DrumPad.STORAGE_KEY, JSON.stringify(this.savedBeats));
        } catch (e) {
            console.error('Error saving beats:', e);
        }
    }

    renderBeatList() {
        if (this.savedBeats.length === 0) {
            this.beatList.classList.remove('has-beats');
            this.beatListItems.innerHTML = '';
            return;
        }

        this.beatList.classList.add('has-beats');
        this.beatListItems.innerHTML = '';

        this.savedBeats.forEach((beat, index) => {
            const isPlaying = this.playingBeats.has(index);
            const beatItem = document.createElement('div');
            beatItem.className = 'beat-item';
            beatItem.innerHTML = `
                <span class="beat-name">${this.escapeHtml(beat.name)}</span>
                <span class="beat-duration">${this.formatDuration(beat.duration)}</span>
                <button class="beat-btn beat-repeat-btn ${beat.repeat ? '' : 'off'}" data-index="${index}" title="Toggle Repeat">
                    🔁
                </button>
                <button class="beat-btn beat-play-btn ${isPlaying ? 'playing' : ''}" data-index="${index}" title="${isPlaying ? 'Pause' : 'Play'}">
                    ${isPlaying ? '⏸' : '▶'}
                </button>
                <button class="beat-btn beat-delete-btn" data-index="${index}" title="Delete">
                    🗑
                </button>
            `;
            this.beatListItems.appendChild(beatItem);

            // Add event listeners
            beatItem.querySelector('.beat-repeat-btn').addEventListener('click', (e) => {
                this.toggleRepeat(index);
            });

            beatItem.querySelector('.beat-play-btn').addEventListener('click', (e) => {
                if (this.playingBeats.has(index)) {
                    this.stopBeat(index);
                } else {
                    this.playBeat(index);
                }
            });

            beatItem.querySelector('.beat-delete-btn').addEventListener('click', (e) => {
                this.deleteBeat(index);
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const milliseconds = ms % 1000;
        return `${seconds}.${Math.floor(milliseconds / 100)}s`;
    }

    toggleRepeat(index) {
        this.savedBeats[index].repeat = !this.savedBeats[index].repeat;
        this.saveBeatsToStorage();
        this.renderBeatList();
    }

    playBeat(index) {
        this.initAudioContext();

        // Stop this specific beat if it's already playing
        if (this.playingBeats.has(index)) {
            this.stopBeat(index);
        }

        const beat = this.savedBeats[index];
        if (!beat || beat.events.length === 0) return;

        // Initialize timeout array for this beat
        this.playingBeats.set(index, []);
        this.renderBeatList();

        const playEvents = () => {
            const timeouts = this.playingBeats.get(index);
            if (!timeouts) return; // Beat was stopped

            beat.events.forEach(event => {
                const timeout = setTimeout(() => {
                    // Save current modifiers
                    const savedModifiers = { ...this.modifiers };

                    // Apply recorded modifiers
                    this.modifiers = { ...event.modifiers };

                    // Play the sound
                    this.playSound(event.sound);

                    // Restore modifiers
                    this.modifiers = savedModifiers;
                }, event.time);
                timeouts.push(timeout);
            });

            // Schedule next loop if repeat is enabled
            if (beat.repeat && this.playingBeats.has(index)) {
                const loopTimeout = setTimeout(() => {
                    if (this.playingBeats.has(index)) {
                        // Clear old timeouts and start fresh
                        this.playingBeats.set(index, []);
                        playEvents();
                    }
                }, beat.duration);
                timeouts.push(loopTimeout);
            } else {
                // Stop after playback completes
                const stopTimeout = setTimeout(() => {
                    if (this.playingBeats.has(index)) {
                        this.stopBeat(index);
                    }
                }, beat.duration);
                timeouts.push(stopTimeout);
            }
        };

        playEvents();
    }

    stopBeat(index) {
        const timeouts = this.playingBeats.get(index);
        if (timeouts) {
            timeouts.forEach(timeout => clearTimeout(timeout));
        }
        this.playingBeats.delete(index);
        this.renderBeatList();
    }

    stopPlayback() {
        // Stop all playing beats
        for (const [index, timeouts] of this.playingBeats) {
            timeouts.forEach(timeout => clearTimeout(timeout));
        }
        this.playingBeats.clear();
        this.renderBeatList();
    }

    deleteBeat(index) {
        if (this.playingBeats.has(index)) {
            this.stopBeat(index);
        }
        this.savedBeats.splice(index, 1);
        // Update playingBeats indices for beats after the deleted one
        const newPlayingBeats = new Map();
        for (const [beatIndex, timeouts] of this.playingBeats) {
            if (beatIndex > index) {
                newPlayingBeats.set(beatIndex - 1, timeouts);
            } else if (beatIndex < index) {
                newPlayingBeats.set(beatIndex, timeouts);
            }
            // beatIndex === index is already stopped and removed, skip it
        }
        this.playingBeats = newPlayingBeats;
        this.saveBeatsToStorage();
        this.renderBeatList();
    }

    cleanupTempo() {
        // Only works on the most recent recording or if we have a selected beat
        if (this.recordedEvents.length === 0 && this.savedBeats.length === 0) {
            return;
        }

        // Get events to analyze (either current recording or last saved beat)
        let events;
        let targetBeatIndex = -1;

        if (this.recordedEvents.length > 0) {
            events = this.recordedEvents;
        } else {
            targetBeatIndex = this.savedBeats.length - 1;
            events = this.savedBeats[targetBeatIndex].events;
        }

        if (events.length < 4) {
            return; // Need at least 4 events to detect tempo
        }

        // Detect tempo by finding intervals between hits
        const intervals = [];
        for (let i = 1; i < events.length; i++) {
            intervals.push(events[i].time - events[i - 1].time);
        }

        // Find the most common interval (beat duration) using clustering
        const sortedIntervals = [...intervals].sort((a, b) => a - b);
        const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)];

        // Filter intervals that are close to the median (within 20%)
        const tolerance = medianInterval * 0.2;
        const consistentIntervals = intervals.filter(
            i => Math.abs(i - medianInterval) <= tolerance
        );

        if (consistentIntervals.length < 2) {
            return; // Not enough consistent beats
        }

        // Calculate average beat interval
        const avgInterval = consistentIntervals.reduce((a, b) => a + b, 0) / consistentIntervals.length;

        // Determine how many beats we have (round to nearest 4 for common time signatures)
        const totalDuration = events[events.length - 1].time - events[0].time;
        let beatCount = Math.round(totalDuration / avgInterval);

        // Round to multiples of 4 for cleaner loops (assumes 4/4 time signature,
        // which is the most common in popular music. Future enhancement could
        // detect or allow user to select other time signatures like 3/4 or 6/8)
        beatCount = Math.round(beatCount / 4) * 4;
        if (beatCount < 4) beatCount = 4;

        // Calculate ideal loop duration
        const idealDuration = beatCount * avgInterval;

        // Find the best starting point (look for a strong hit pattern)
        let bestStartIndex = 0;
        let bestScore = 0;

        for (let i = 0; i < Math.min(events.length, 8); i++) {
            // Score based on how well subsequent hits align with the tempo
            let score = 0;
            const startTime = events[i].time;

            for (let j = i + 1; j < events.length; j++) {
                const timeSinceStart = events[j].time - startTime;
                const expectedBeat = Math.round(timeSinceStart / avgInterval);
                const expectedTime = expectedBeat * avgInterval;
                const deviation = Math.abs(timeSinceStart - expectedTime);

                if (deviation < tolerance) {
                    score++;
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestStartIndex = i;
            }
        }

        // Trim events to the ideal duration
        const startTime = events[bestStartIndex].time;
        const endTime = startTime + idealDuration;

        const trimmedEvents = events
            .filter(e => e.time >= startTime && e.time < endTime)
            .map(e => ({
                ...e,
                time: e.time - startTime // Normalize to start at 0
            }));

        if (trimmedEvents.length === 0) {
            return;
        }

        // Set the loop duration to idealDuration so that when the loop repeats,
        // the gap from the last beat to the first beat of the next loop equals avgInterval.
        // This ensures seamless looping where listeners can't detect the loop point.
        const loopDuration = idealDuration;

        // Update the events
        if (this.recordedEvents.length > 0) {
            this.recordedEvents = trimmedEvents;
        } else {
            this.savedBeats[targetBeatIndex].events = trimmedEvents;
            this.savedBeats[targetBeatIndex].duration = loopDuration;
            this.saveBeatsToStorage();
            this.renderBeatList();
        }
    }

    handlePadPress(pad) {
        this.initAudioContext();

        const soundType = pad.dataset.sound;

        // Add active class for visual feedback
        pad.classList.add('active');

        // If in sample recording mode, save the sample to this pad
        if (this.isSampleRecording) {
            this.saveSampleToPad(soundType);
            return;
        }

        // Record the event if recording
        this.recordEvent(soundType);

        // Play the sound for this specific pad
        this.playSound(soundType);
    }

    handlePadRelease(pad) {
        pad.classList.remove('active');
    }

    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.createReverbBuffer();
        }

        // Resume if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    async createReverbBuffer() {
        // Create a simple reverb impulse response
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * DrumPad.REVERB_DURATION;
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
            }
        }

        this.reverbBuffer = impulse;
    }

    playSound(soundType) {
        if (!this.audioContext) return;

        // Check for custom sample first
        if (this.customSamples[soundType]) {
            this.playCustomSample(soundType).catch(err => {
                console.error('Error playing custom sample:', err);
            });
            return;
        }

        const time = this.audioContext.currentTime;

        // Calculate pitch modifier based on settings
        let pitchMod = 1;
        if (this.modifiers.pitchUp) pitchMod = 1.5;
        if (this.modifiers.pitchDown) pitchMod = 0.7;

        // Set volume
        const volume = 0.8;

        // Create the sound based on sound type
        const soundNode = this.createSound(soundType, time, pitchMod);
        if (!soundNode) return;

        // Create gain node for volume control
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(volume, time);

        // Apply effects chain
        let currentNode = soundNode;

        // Distortion
        if (this.modifiers.distortion) {
            const distortion = this.createDistortion();
            currentNode.connect(distortion);
            currentNode = distortion;
        }

        // Reverb
        if (this.modifiers.reverb && this.reverbBuffer) {
            const convolver = this.audioContext.createConvolver();
            convolver.buffer = this.reverbBuffer;

            const dryGain = this.audioContext.createGain();
            const wetGain = this.audioContext.createGain();
            dryGain.gain.value = 0.7;
            wetGain.gain.value = 0.5;

            currentNode.connect(dryGain);
            currentNode.connect(convolver);
            convolver.connect(wetGain);

            dryGain.connect(gainNode);
            wetGain.connect(gainNode);
        } else {
            currentNode.connect(gainNode);
        }

        gainNode.connect(this.audioContext.destination);

        // Start sound
        if (soundNode.start) {
            soundNode.start(time);
        }
    }

    createSound(type, time, pitchMod) {
        switch (type) {
            case 'kick':
                return this.createKick(time, pitchMod);
            case 'snare':
                return this.createSnare(time, pitchMod);
            case 'hihat':
                return this.createHiHat(time, pitchMod);
            case 'tom':
                return this.createTom(time, pitchMod);
            case 'cymbal':
                return this.createCymbal(time, pitchMod);
            case 'clap':
                return this.createClap(time, pitchMod);
            case 'cowbell':
                return this.createCowbell(time, pitchMod);
            case 'rim':
                return this.createRim(time, pitchMod);
            case 'shaker':
                return this.createShaker(time, pitchMod);
            default:
                return this.createKick(time, pitchMod);
        }
    }

    createKick(time, pitchMod) {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(150 * pitchMod, time);
        osc.frequency.exponentialRampToValueAtTime(50 * pitchMod, time + 0.1);

        gain.gain.setValueAtTime(1, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

        osc.connect(gain);
        osc.start(time);
        osc.stop(time + 0.3);

        return gain;
    }

    createSnare(time, pitchMod) {
        // Noise component
        const noiseLength = 0.2;
        const bufferSize = this.audioContext.sampleRate * noiseLength;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.audioContext.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000 * pitchMod;

        const noiseGain = this.audioContext.createGain();
        noiseGain.gain.setValueAtTime(0.8, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);

        // Tone component
        const osc = this.audioContext.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 200 * pitchMod;

        const oscGain = this.audioContext.createGain();
        oscGain.gain.setValueAtTime(0.7, time);
        oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

        // Mix
        const mixGain = this.audioContext.createGain();

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(mixGain);

        osc.connect(oscGain);
        oscGain.connect(mixGain);

        noise.start(time);
        noise.stop(time + 0.2);
        osc.start(time);
        osc.stop(time + 0.1);

        return mixGain;
    }

    createHiHat(time, pitchMod) {
        const bufferSize = this.audioContext.sampleRate * 0.1;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        const highpass = this.audioContext.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 7000 * pitchMod;

        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);

        noise.connect(highpass);
        highpass.connect(gain);

        noise.start(time);
        noise.stop(time + 0.1);

        return gain;
    }

    createTom(time, pitchMod) {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(200 * pitchMod, time);
        osc.frequency.exponentialRampToValueAtTime(100 * pitchMod, time + 0.15);

        gain.gain.setValueAtTime(0.8, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.25);

        osc.connect(gain);
        osc.start(time);
        osc.stop(time + 0.25);

        return gain;
    }

    createCymbal(time, pitchMod) {
        const bufferSize = this.audioContext.sampleRate * 0.5;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        const bandpass = this.audioContext.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 5000 * pitchMod;
        bandpass.Q.value = 1;

        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.4);

        noise.connect(bandpass);
        bandpass.connect(gain);

        noise.start(time);
        noise.stop(time + 0.5);

        return gain;
    }

    createClap(time, pitchMod) {
        const gain = this.audioContext.createGain();

        // Multiple noise bursts for clap texture
        for (let i = 0; i < 3; i++) {
            const bufferSize = this.audioContext.sampleRate * 0.02;
            const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
            const data = buffer.getChannelData(0);

            for (let j = 0; j < bufferSize; j++) {
                data[j] = Math.random() * 2 - 1;
            }

            const noise = this.audioContext.createBufferSource();
            noise.buffer = buffer;

            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 2000 * pitchMod;
            filter.Q.value = 2;

            const burstGain = this.audioContext.createGain();
            const startTime = time + i * 0.01;
            burstGain.gain.setValueAtTime(0.8, startTime);
            burstGain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.05);

            noise.connect(filter);
            filter.connect(burstGain);
            burstGain.connect(gain);

            noise.start(startTime);
            noise.stop(startTime + 0.05);
        }

        return gain;
    }

    createCowbell(time, pitchMod) {
        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc1.type = 'square';
        osc1.frequency.value = 800 * pitchMod;

        osc2.type = 'square';
        osc2.frequency.value = 540 * pitchMod;

        gain.gain.setValueAtTime(0.3, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

        const filter = this.audioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 600 * pitchMod;
        filter.Q.value = 3;

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);

        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + 0.3);
        osc2.stop(time + 0.3);

        return gain;
    }

    createRim(time, pitchMod) {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.type = 'triangle';
        osc.frequency.value = 1200 * pitchMod;

        gain.gain.setValueAtTime(0.5, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.03);

        osc.connect(gain);
        osc.start(time);
        osc.stop(time + 0.03);

        return gain;
    }

    createShaker(time, pitchMod) {
        const bufferSize = this.audioContext.sampleRate * 0.15;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);

        // Create a shaker sound with quick bursts of filtered noise
        for (let i = 0; i < bufferSize; i++) {
            // Add some randomness with envelope
            const envelope = Math.sin((i / bufferSize) * Math.PI);
            data[i] = (Math.random() * 2 - 1) * envelope * 0.8;
        }

        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;

        const highpass = this.audioContext.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 4000 * pitchMod;

        const lowpass = this.audioContext.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 10000 * pitchMod;

        const gain = this.audioContext.createGain();
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

        noise.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(gain);

        noise.start(time);
        noise.stop(time + 0.15);

        return gain;
    }

    createDistortion() {
        const distortion = this.audioContext.createWaveShaper();
        const curve = new Float32Array(DrumPad.WAVE_SHAPER_SAMPLES);

        for (let i = 0; i < DrumPad.WAVE_SHAPER_SAMPLES; i++) {
            const x = (i * 2) / DrumPad.WAVE_SHAPER_SAMPLES - 1;
            curve[i] = ((3 + DrumPad.DISTORTION_AMOUNT) * x * 20 * (Math.PI / 180)) / (Math.PI + DrumPad.DISTORTION_AMOUNT * Math.abs(x));
        }

        distortion.curve = curve;
        distortion.oversample = '4x';

        return distortion;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new DrumPad();
});
