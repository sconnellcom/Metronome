// Drum Pad Application
class DrumPad {
    // Audio effect constants
    static REVERB_DURATION = 2; // seconds
    static DISTORTION_AMOUNT = 50;
    static WAVE_SHAPER_SAMPLES = 44100;

    constructor() {
        this.audioContext = null;
        this.currentSound = 'kick';
        this.modifiers = {
            reverb: false,
            distortion: false,
            pitchUp: false,
            pitchDown: false
        };
        
        // Touch tracking
        this.lastTouchTime = 0;
        this.lastTouchX = 0;
        this.lastTouchY = 0;
        this.touchDebounceMs = 50;
        
        // Canvas for visual feedback
        this.canvas = null;
        this.ctx = null;
        this.trails = [];
        
        // Reverb convolver
        this.convolverNode = null;
        this.reverbBuffer = null;
        
        this.initializeUI();
        this.setupEventListeners();
        this.initializeTheme();
        this.initializeCanvas();
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('padTheme') || 'default';
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
        localStorage.setItem('padTheme', theme);
    }

    initializeUI() {
        // Theme elements
        this.themeBtnActive = document.querySelector('.theme-btn-active');
        this.themeDropdown = document.querySelector('.theme-dropdown');
        
        // Touch area
        this.touchArea = document.getElementById('touchArea');
        this.touchFeedback = document.getElementById('touchFeedback');
        this.canvas = document.getElementById('touchCanvas');
        
        // Info modal
        this.infoBtn = document.getElementById('infoBtn');
        this.infoModal = document.getElementById('infoModal');
        this.closeInfoBtn = document.getElementById('closeInfoBtn');
    }

    initializeCanvas() {
        const resizeCanvas = () => {
            const rect = this.touchArea.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        this.ctx = this.canvas.getContext('2d');
        this.animateTrails();
    }

    animateTrails() {
        if (!this.ctx) return;
        
        // Clear canvas with fade effect
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw and update trails
        this.trails = this.trails.filter(trail => {
            trail.opacity -= 0.02;
            if (trail.opacity <= 0) return false;
            
            this.ctx.beginPath();
            this.ctx.arc(trail.x, trail.y, trail.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${trail.r}, ${trail.g}, ${trail.b}, ${trail.opacity})`;
            this.ctx.fill();
            
            trail.radius += 0.5;
            return true;
        });
        
        requestAnimationFrame(() => this.animateTrails());
    }

    addTrail(x, y, velocity) {
        // Get theme color
        const style = getComputedStyle(document.body);
        const primaryColor = style.getPropertyValue('--primary-color').trim() || '#667eea';
        
        // Parse color
        let r = 102, g = 126, b = 234;
        if (primaryColor.startsWith('#')) {
            const hex = primaryColor.slice(1);
            r = parseInt(hex.slice(0, 2), 16);
            g = parseInt(hex.slice(2, 4), 16);
            b = parseInt(hex.slice(4, 6), 16);
        }
        
        // Add multiple particles for better effect
        const particleCount = Math.min(5, Math.ceil(velocity / 50));
        for (let i = 0; i < particleCount; i++) {
            this.trails.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                radius: 5 + velocity / 20,
                opacity: 0.8,
                r, g, b
            });
        }
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

        // Effect buttons
        document.querySelectorAll('.effect-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.effect-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentSound = btn.dataset.effect;
            });
        });

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

        // Touch area events
        this.touchArea.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.touchArea.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.touchArea.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        
        // Mouse events for desktop
        this.touchArea.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.touchArea.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.touchArea.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.touchArea.addEventListener('mouseleave', (e) => this.handleMouseUp(e));

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

    handleTouchStart(e) {
        e.preventDefault();
        this.initAudioContext();
        this.isMouseDown = true;
        
        const touch = e.touches[0];
        const rect = this.touchArea.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        this.lastTouchX = x;
        this.lastTouchY = y;
        this.lastTouchTime = Date.now();
        
        // Play initial sound
        this.playSound(x, y, rect.width, rect.height, 100);
        this.showFeedback(touch.clientX - rect.left, touch.clientY - rect.top);
    }

    handleTouchMove(e) {
        e.preventDefault();
        
        const touch = e.touches[0];
        const rect = this.touchArea.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        const now = Date.now();
        const timeDiff = now - this.lastTouchTime;
        
        if (timeDiff < this.touchDebounceMs) return;
        
        // Calculate velocity
        const dx = x - this.lastTouchX;
        const dy = y - this.lastTouchY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const velocity = distance / timeDiff * 100;
        
        if (velocity > 5) { // Only trigger on meaningful movement
            this.playSound(x, y, rect.width, rect.height, velocity);
            this.addTrail(x, y, velocity);
        }
        
        this.lastTouchX = x;
        this.lastTouchY = y;
        this.lastTouchTime = now;
    }

    handleTouchEnd(e) {
        e.preventDefault();
        this.isMouseDown = false;
        this.touchFeedback.classList.remove('active');
    }

    handleMouseDown(e) {
        this.initAudioContext();
        this.isMouseDown = true;
        
        const rect = this.touchArea.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.lastTouchX = x;
        this.lastTouchY = y;
        this.lastTouchTime = Date.now();
        
        this.playSound(x, y, rect.width, rect.height, 100);
        this.showFeedback(x, y);
    }

    handleMouseMove(e) {
        if (!this.isMouseDown) return;
        
        const rect = this.touchArea.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const now = Date.now();
        const timeDiff = now - this.lastTouchTime;
        
        if (timeDiff < this.touchDebounceMs) return;
        
        const dx = x - this.lastTouchX;
        const dy = y - this.lastTouchY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const velocity = distance / timeDiff * 100;
        
        if (velocity > 5) {
            this.playSound(x, y, rect.width, rect.height, velocity);
            this.addTrail(x, y, velocity);
        }
        
        this.lastTouchX = x;
        this.lastTouchY = y;
        this.lastTouchTime = now;
    }

    handleMouseUp() {
        this.isMouseDown = false;
        this.touchFeedback.classList.remove('active');
    }

    showFeedback(x, y) {
        this.touchFeedback.style.left = `${x}px`;
        this.touchFeedback.style.top = `${y}px`;
        this.touchFeedback.classList.remove('active');
        void this.touchFeedback.offsetWidth; // Trigger reflow
        this.touchFeedback.classList.add('active');
    }

    playSound(x, y, width, height, velocity) {
        if (!this.audioContext) return;
        
        const time = this.audioContext.currentTime;
        
        // Calculate volume based on distance from center
        const centerX = width / 2;
        const centerY = height / 2;
        const distFromCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
        const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
        const volume = 0.3 + 0.7 * (1 - distFromCenter / maxDist);
        
        // Calculate pitch modifier based on velocity and y position
        let pitchMod = 1;
        if (this.modifiers.pitchUp) pitchMod = 1.5;
        if (this.modifiers.pitchDown) pitchMod = 0.7;
        
        // Velocity affects pitch slightly
        pitchMod *= 0.8 + (velocity / 500);
        
        // Create the sound based on current selection
        const soundNode = this.createSound(this.currentSound, time, pitchMod);
        if (!soundNode) return;
        
        // Create gain node for volume control
        const gainNode = this.audioContext.createGain();
        gainNode.gain.setValueAtTime(volume * 0.5, time);
        
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
        osc.stop(time + 0.03);
        
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
