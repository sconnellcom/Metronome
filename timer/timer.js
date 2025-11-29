// Timer Suite Application
// Theme management, countdown timers, stopwatch, and alarms

class TimerApp {
    constructor() {
        this.timers = [];
        this.timerIdCounter = 0;
        this.timerUpdateInterval = null;
        this.timerSaveInterval = null;

        this.stopwatchTimer = null;
        this.stopwatchStartTime = null;
        this.stopwatchBaseElapsed = 0; // Time from previous sessions
        this.stopwatchRunning = false;
        this.stopwatchSaveInterval = null;
        this.lapCounter = 0;

        this.alarms = [];
        this.alarmCheckInterval = null;
        this.alarmBeepInterval = null;
        this.activeAlerts = [];

        this.clockUpdateInterval = null;
        this.showClockSeconds = this.loadClockSecondsPreference();

        this.initializeTheme();
        this.loadFromLocalStorage();
        this.initializeElements();
        this.initializeEventListeners();
        this.renderTimers();
        this.renderAlarms();
        this.startClockUpdate(); // Start clock since it's the default tab
        // Set initial page title and H1 based on active tab
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            const tabText = activeTab.textContent.trim();
            document.title = tabText;
            const h1 = document.querySelector('h1');
            if (h1) {
                h1.textContent = `⏱️ ${tabText}`;
            }
        }
        if (this.alarms.length > 0) {
            this.startAlarmCheck();
        }
        if (this.timers.some(t => t.running)) {
            this.startTimerUpdates();
        }
        this.setupStorageSync();
    }

    // Theme Management
    initializeTheme() {
        const savedTheme = localStorage.getItem('timerTheme') || 'default';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-warm-light', 'theme-warm-dark',
            'theme-red', 'theme-pink', 'theme-red-dark', 'theme-pink-dark', 'theme-black', 'theme-blue', 'theme-blue-dark');

        if (theme !== 'default') {
            document.body.classList.add(`theme-${theme}`);
        }

        document.querySelectorAll('.theme-btn-active').forEach(btn => {
            btn.className = `theme-btn-active theme-${theme}`;
        });

        localStorage.setItem('timerTheme', theme);
    }

    // Clock seconds preference
    loadClockSecondsPreference() {
        const saved = localStorage.getItem('timerShowClockSeconds');
        // Default to showing seconds if no preference is saved
        return saved === null ? true : saved === 'true';
    }

    saveClockSecondsPreference() {
        localStorage.setItem('timerShowClockSeconds', this.showClockSeconds.toString());
    }

    toggleClockSeconds() {
        this.showClockSeconds = !this.showClockSeconds;
        this.saveClockSecondsPreference();
        this.updateClock();
    }

    saveToLocalStorage() {
        const now = Date.now();
        const data = {
            alarms: this.alarms,
            timers: this.timers.map(t => {
                let pausedMs = t.pausedMs;
                // If timer is running, calculate current remaining time
                if (t.running && !t.completed) {
                    pausedMs = Math.max(0, t.endTime - now);
                }
                return {
                    id: t.id,
                    name: t.name,
                    totalMs: t.totalMs,
                    pausedMs: pausedMs,
                    running: t.running && !t.completed && !t.sounding,
                    paused: t.paused,
                    completed: t.completed,
                    sounding: t.sounding,
                    showElapsed: t.showElapsed || false,
                    completionTime: t.completionTime,
                    endTime: t.endTime
                };
            }),
            stopwatch: {
                baseElapsed: this.stopwatchBaseElapsed,
                running: this.stopwatchRunning,
                startTime: this.stopwatchStartTime,
                lastUpdate: this.stopwatchRunning ? now : null
            },
            timerIdCounter: this.timerIdCounter,
            savedAt: now
        };
        localStorage.setItem('timerData', JSON.stringify(data));
    }

    setupStorageSync() {
        // Listen for storage changes from other tabs
        window.addEventListener('storage', (e) => {
            if (e.key === 'timerData' && e.newValue) {
                this.syncFromStorage(e.newValue);
            }
        });
    }

    syncFromStorage(dataString) {
        try {
            const parsed = JSON.parse(dataString);
            const now = Date.now();

            // Sync alarms
            this.alarms = parsed.alarms || [];
            this.alarms.forEach(alarm => {
                if (!alarm.triggered) alarm.triggered = false;
                if (!alarm.sounding) alarm.sounding = false;
            });
            this.renderAlarms();

            // Sync timers
            if (parsed.timers) {
                const oldTimerIds = new Set(this.timers.map(t => t.id));
                const newTimerIds = new Set(parsed.timers.map(t => t.id));

                // Check if any timers were deleted
                const deletedTimers = [...oldTimerIds].filter(id => !newTimerIds.has(id));
                if (deletedTimers.length > 0) {
                    // If a sounding timer was deleted, stop the beep and remove alerts
                    const hadSoundingTimer = this.timers.some(t => deletedTimers.includes(t.id) && t.sounding);
                    if (hadSoundingTimer) {
                        this.stopAlarmBeep();
                        this.removeAlert('countdown');
                    }
                }

                // Update existing timers and add new ones
                this.timers = parsed.timers.map(t => {
                    const existing = this.timers.find(et => et.id === t.id);

                    // If timer is running in this tab, keep it running
                    if (existing && existing.running && !t.paused) {
                        return { ...existing, name: t.name, totalMs: t.totalMs, showElapsed: t.showElapsed };
                    }

                    // If timer was paused in another tab, pause it here too
                    if (t.paused) {
                        return {
                            ...t,
                            running: false,
                            paused: true,
                            endTime: null
                        };
                    }

                    // For running timers from other tabs, sync them
                    if (t.running) {
                        const timeSinceSave = now - (parsed.savedAt || now);
                        const remainingMs = Math.max(0, t.pausedMs - timeSinceSave);
                        return {
                            ...t,
                            endTime: now + remainingMs,
                            pausedMs: remainingMs
                        };
                    }

                    // For completed/sounding timers
                    return { ...t };
                });
                this.renderTimers();

                // Start timer updates if needed
                if (this.timers.some(t => t.running) && !this.timerUpdateInterval) {
                    this.startTimerUpdates();
                }
            }

            // Sync stopwatch
            if (parsed.stopwatch) {
                const wasRunning = this.stopwatchRunning;
                const isNowRunning = parsed.stopwatch.running;

                // Check if another tab is actively managing the stopwatch
                const otherTabIsActive = parsed.stopwatch.lastUpdate && (now - parsed.stopwatch.lastUpdate) < 7000;

                // If stopwatch was started in another tab
                if (!wasRunning && isNowRunning) {
                    this.stopwatchBaseElapsed = parsed.stopwatch.baseElapsed || 0;
                    this.stopwatchRunning = true;
                    this.stopwatchStartTime = parsed.stopwatch.startTime || now;

                    // Always start display timer when stopwatch starts
                    if (!this.stopwatchTimer) {
                        this.stopwatchTimer = setInterval(() => this.updateStopwatchDisplay(), 10);
                    }

                    // Only start save interval if another tab isn't already managing it
                    if (!otherTabIsActive && !this.stopwatchSaveInterval) {
                        this.stopwatchSaveInterval = setInterval(() => this.saveToLocalStorage(), 5000);
                    }

                    this.stopwatchStart.style.display = 'none';
                    this.stopwatchStop.style.display = '';
                    this.stopwatchLap.disabled = false;
                }
                // If stopwatch was stopped in another tab
                else if (wasRunning && !isNowRunning) {
                    this.stopwatchBaseElapsed = parsed.stopwatch.baseElapsed || 0;
                    this.stopwatchRunning = false;
                    this.stopwatchStartTime = null;

                    // Stop the display update
                    if (this.stopwatchTimer) {
                        clearInterval(this.stopwatchTimer);
                        this.stopwatchTimer = null;
                    }
                    if (this.stopwatchSaveInterval) {
                        clearInterval(this.stopwatchSaveInterval);
                        this.stopwatchSaveInterval = null;
                    }

                    this.stopwatchStart.style.display = '';
                    this.stopwatchStop.style.display = 'none';
                    this.stopwatchLap.disabled = true;
                }
                // If both tabs think stopwatch is running
                else if (wasRunning && isNowRunning) {
                    if (otherTabIsActive) {
                        // Another tab is actively managing it, stop our own save interval to avoid conflict
                        if (this.stopwatchSaveInterval) {
                            clearInterval(this.stopwatchSaveInterval);
                            this.stopwatchSaveInterval = null;
                        }
                        // Sync to the other tab's time - use the same startTime!
                        this.stopwatchBaseElapsed = parsed.stopwatch.baseElapsed || 0;
                        this.stopwatchStartTime = parsed.stopwatch.startTime || now;

                        // Keep display timer running for passive tab
                        if (!this.stopwatchTimer) {
                            this.stopwatchTimer = setInterval(() => this.updateStopwatchDisplay(), 10);
                        }
                    } else {
                        // Other tab might have closed, we should take over
                        if (!this.stopwatchTimer) {
                            this.stopwatchTimer = setInterval(() => this.updateStopwatchDisplay(), 10);
                        }
                        if (!this.stopwatchSaveInterval) {
                            this.stopwatchSaveInterval = setInterval(() => this.saveToLocalStorage(), 5000);
                        }
                        // Sync to the saved state
                        this.stopwatchBaseElapsed = parsed.stopwatch.baseElapsed || 0;
                        this.stopwatchStartTime = parsed.stopwatch.startTime || now;
                    }
                }
                // If stopwatch is not running in either tab, sync the base elapsed time
                else if (!wasRunning && !isNowRunning) {
                    this.stopwatchBaseElapsed = parsed.stopwatch.baseElapsed || 0;
                }

                // Update display
                if (this.stopwatchDisplay) {
                    let displayElapsed;
                    if (this.stopwatchRunning && this.stopwatchStartTime) {
                        // Calculate from startTime (works for both active and passive tabs)
                        displayElapsed = this.stopwatchBaseElapsed + (now - this.stopwatchStartTime);
                    } else {
                        displayElapsed = this.stopwatchBaseElapsed;
                    }
                    const hours = Math.floor(displayElapsed / 3600000);
                    const minutes = Math.floor((displayElapsed % 3600000) / 60000);
                    const seconds = Math.floor((displayElapsed % 60000) / 1000);
                    const ms = displayElapsed % 1000;
                    this.stopwatchDisplay.textContent = this.formatTimeMs(hours, minutes, seconds, ms);
                }
            }

            // Update clock view
            this.updateActiveItems();
        } catch (e) {
            console.error('Failed to sync from storage:', e);
        }
    }

    loadFromLocalStorage() {
        const data = localStorage.getItem('timerData');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                const now = Date.now();
                const timeSinceLastSave = parsed.savedAt ? now - parsed.savedAt : 0;

                // Load alarms
                this.alarms = parsed.alarms || [];
                this.alarms.forEach(alarm => {
                    alarm.triggered = false;
                    alarm.sounding = false;
                });

                // Load timers
                if (parsed.timers && parsed.timers.length > 0) {
                    this.timers = parsed.timers.map(t => {
                        const timer = { ...t };

                        if (timer.running && !timer.completed) {
                            // Calculate how much time passed since last save
                            const remainingAtSave = timer.pausedMs || Math.max(0, timer.endTime - parsed.savedAt);
                            const remainingNow = Math.max(0, remainingAtSave - timeSinceLastSave);

                            if (remainingNow > 0) {
                                // Timer still has time left, resume it
                                timer.endTime = now + remainingNow;
                                timer.pausedMs = remainingNow;
                            } else {
                                // Timer should have completed during downtime
                                timer.running = false;
                                timer.completed = true;
                                timer.sounding = true;
                                timer.completionTime = parsed.savedAt + remainingAtSave;
                                timer.pausedMs = 0;
                            }
                        } else if (timer.sounding && timer.completionTime) {
                            // Keep sounding timers in their state
                            timer.completionTime = timer.completionTime;
                        } else {
                            timer.endTime = timer.paused ? now + timer.pausedMs : null;
                        }

                        return timer;
                    });
                }

                // Load stopwatch
                if (parsed.stopwatch) {
                    // Check if another tab might be actively running (saved within last 7 seconds)
                    const possiblyActiveInOtherTab = parsed.stopwatch.lastUpdate &&
                        (now - parsed.stopwatch.lastUpdate) < 7000;

                    if (parsed.stopwatch.running) {
                        // Restore the base elapsed and startTime
                        this.stopwatchBaseElapsed = parsed.stopwatch.baseElapsed || 0;
                        this.stopwatchRunning = true;

                        if (possiblyActiveInOtherTab && parsed.stopwatch.startTime) {
                            // Another tab is running, use its startTime
                            this.stopwatchStartTime = parsed.stopwatch.startTime;
                        } else if (parsed.stopwatch.startTime) {
                            // Page was closed/reloaded, need to account for time offline
                            // Add the offline time to baseElapsed and set new startTime
                            this.stopwatchBaseElapsed += timeSinceLastSave;
                            this.stopwatchStartTime = now;
                        } else {
                            // No startTime saved (shouldn't happen), set to now
                            this.stopwatchStartTime = now;
                        }
                    } else {
                        this.stopwatchBaseElapsed = parsed.stopwatch.baseElapsed || 0;
                        this.stopwatchRunning = false;
                        this.stopwatchStartTime = null;
                    }

                    if (this.stopwatchBaseElapsed > 0 || this.stopwatchRunning) {
                        // Update display after elements are initialized
                        setTimeout(() => {
                            const currentElapsed = this.stopwatchRunning && this.stopwatchStartTime
                                ? this.stopwatchBaseElapsed + (now - this.stopwatchStartTime)
                                : this.stopwatchBaseElapsed;
                            const hours = Math.floor(currentElapsed / 3600000);
                            const minutes = Math.floor((currentElapsed % 3600000) / 60000);
                            const seconds = Math.floor((currentElapsed % 60000) / 1000);
                            const ms = currentElapsed % 1000;
                            this.stopwatchDisplay.textContent = this.formatTimeMs(hours, minutes, seconds, ms);

                            // Resume stopwatch if it was running AND another tab isn't already managing it
                            if (this.stopwatchRunning && !possiblyActiveInOtherTab) {
                                this.stopwatchStart.style.display = 'none';
                                this.stopwatchStop.style.display = '';
                                this.stopwatchLap.disabled = false;
                                this.stopwatchTimer = setInterval(() => this.updateStopwatchDisplay(), 10);
                                if (!this.stopwatchSaveInterval) {
                                    this.stopwatchSaveInterval = setInterval(() => this.saveToLocalStorage(), 5000);
                                }
                            } else if (this.stopwatchRunning && possiblyActiveInOtherTab) {
                                // Another tab is managing it, but we still need to update our display
                                this.stopwatchStart.style.display = 'none';
                                this.stopwatchStop.style.display = '';
                                this.stopwatchLap.disabled = false;
                                // Start display timer even as passive tab
                                this.stopwatchTimer = setInterval(() => this.updateStopwatchDisplay(), 10);
                                // Don't start save interval - let the active tab handle that
                            }
                        }, 0);
                    }
                }

                this.timerIdCounter = parsed.timerIdCounter || 0;
            } catch (e) {
                console.error('Failed to load data from localStorage:', e);
            }
        }
    }

    initializeElements() {
        // Countdown elements
        this.timerNameInput = document.getElementById('timer-name');
        this.timeInput = document.getElementById('time-input');
        this.addTimerBtn = document.getElementById('add-timer');
        this.timerList = document.getElementById('timer-list');
        this.countdownStatus = document.getElementById('countdown-status');

        // Stopwatch elements
        this.stopwatchDisplay = document.getElementById('stopwatch-display');
        this.stopwatchStart = document.getElementById('stopwatch-start');
        this.stopwatchStop = document.getElementById('stopwatch-stop');
        this.stopwatchReset = document.getElementById('stopwatch-reset');
        this.stopwatchLap = document.getElementById('stopwatch-lap');
        this.lapTimes = document.getElementById('lap-times');

        // Alarm elements
        this.alarmTimeInput = document.getElementById('alarm-time');
        this.alarmLabelInput = document.getElementById('alarm-label');
        this.alarmAdd = document.getElementById('alarm-add');
        this.alarmList = document.getElementById('alarm-list');
        this.alarmStatus = document.getElementById('alarm-status');

        // Clock elements
        this.clockDisplay = document.getElementById('clock-display');
        this.clockDate = document.getElementById('clock-date');
        this.activeTimersDisplay = document.getElementById('active-timers');
        this.activeStopwatchesDisplay = document.getElementById('active-stopwatches');
        this.activeAlarmsDisplay = document.getElementById('active-alarms');

        // Alert banner
        this.alertBanner = document.getElementById('alert-banner');

        // Silence button
        this.silenceBtn = document.getElementById('silence-btn');
    }

    initializeEventListeners() {
        // Theme picker
        const themePicker = document.querySelector('.theme-picker');
        const themeDropdown = document.querySelector('.theme-dropdown');

        themePicker.addEventListener('click', (e) => {
            if (e.target.closest('.theme-btn-active')) {
                const isVisible = themeDropdown.style.display === 'grid';
                themeDropdown.style.display = isVisible ? 'none' : 'grid';
            }
        });

        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setTheme(btn.dataset.theme);
                themeDropdown.style.display = 'none';
            });
        });

        document.addEventListener('click', (e) => {
            if (!themePicker.contains(e.target)) {
                themeDropdown.style.display = 'none';
            }
        });

        // Tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tabName).classList.add('active');

                // Update page title and H1 to match selected tab
                const tabText = tab.textContent.trim();
                document.title = tabText;
                const h1 = document.querySelector('h1');
                console.log(h1);
                if (h1) {
                    h1.textContent = `⏱️ ${tabText}`;
                }

                if (tabName === 'clock') {
                    this.startClockUpdate();
                } else {
                    this.stopClockUpdate();
                }
            });
        });

        // Clock display click to toggle seconds
        this.clockDisplay.addEventListener('click', () => this.toggleClockSeconds());

        // Alert banner click
        this.alertBanner.addEventListener('click', () => {
            if (this.activeAlerts.length > 0) {
                const alert = this.activeAlerts[0];
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                const targetTab = document.querySelector(`[data-tab="${alert.type}"]`);
                if (targetTab) {
                    targetTab.classList.add('active');
                    document.getElementById(alert.type).classList.add('active');
                }
            }
        });

        // Time input masking
        this.timeInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/[^0-9:]/g, '');
            e.target.value = value;
        });

        this.timeInput.addEventListener('blur', (e) => {
            this.formatTimeInput(e.target);
        });

        // Countdown presets
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const seconds = parseInt(btn.dataset.seconds);
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                const secs = seconds % 60;
                this.timeInput.value = `${hours}:${minutes}:${secs}`;
            });
        });

        // Countdown
        this.addTimerBtn.addEventListener('click', () => this.addTimer());
        this.timerList.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-timer-id]');
            if (button) {
                const timerId = parseInt(button.dataset.timerId);
                const action = button.dataset.action;
                if (action === 'pause') this.pauseTimer(timerId);
                else if (action === 'resume') this.resumeTimer(timerId);
                else if (action === 'dismiss') this.dismissTimer(timerId);
                else if (action === 'restart') this.restartTimer(timerId);
                else if (action === 'delete') this.deleteTimer(timerId);
                return;
            }

            // Check if clicked on timer time display
            const timeDisplay = e.target.closest('.timer-time-display');
            if (timeDisplay) {
                const timerId = parseInt(timeDisplay.dataset.timerId);
                const timer = this.timers.find(t => t.id === timerId);
                if (timer) {
                    timer.showElapsed = !timer.showElapsed;
                    this.renderTimers();
                }
            }
        });

        // Stopwatch
        this.stopwatchStart.addEventListener('click', () => this.startStopwatch());
        this.stopwatchStop.addEventListener('click', () => this.stopStopwatch());
        this.stopwatchReset.addEventListener('click', () => this.resetStopwatch());
        this.stopwatchLap.addEventListener('click', () => this.recordLap());

        // Alarm
        this.alarmAdd.addEventListener('click', () => this.addAlarm());
        this.alarmList.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-alarm-id]');
            if (button) {
                const alarmId = parseInt(button.dataset.alarmId);
                const action = button.dataset.action;
                if (action === 'dismiss') {
                    this.dismissAlarm(alarmId);
                } else if (action === 'restart') {
                    this.restartAlarm(alarmId);
                } else if (action === 'delete') {
                    this.deleteAlarm(alarmId);
                }
                return;
            }

            // Check if clicked on repeat toggle
            const repeatToggle = e.target.closest('.alarm-repeat-toggle');
            if (repeatToggle) {
                const alarmId = parseInt(repeatToggle.dataset.alarmId);
                this.toggleAlarmRepeat(alarmId);
            }
        });

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Silence button
        this.silenceBtn.addEventListener('click', () => this.silenceAlarms());

        // Clock active items click navigation
        document.addEventListener('click', (e) => {
            const activeItem = e.target.closest('.active-item[data-goto-tab]');
            if (activeItem) {
                const targetTab = activeItem.dataset.gotoTab;
                const tabButton = document.querySelector(`[data-tab="${targetTab}"]`);
                if (tabButton) {
                    tabButton.click();
                }
            }
        });
    }

    // Utility functions
    formatTime(hours, minutes, seconds) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    formatTimeMs(hours, minutes, seconds, ms) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    }

    formatTime12Hour(hour, minute) {
        const period = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
    }

    formatTimeInput(input) {
        const parts = input.value.split(':');
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const seconds = parseInt(parts[2]) || 0;
        input.value = `${hours}:${minutes}:${seconds}`;
    }

    parseTimeInput(value) {
        const parts = value.split(':');
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const seconds = parseInt(parts[2]) || 0;
        return { hours, minutes, seconds };
    }

    playSound(repeat = false) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);

        if (repeat) {
            this.stopAlarmBeep();
            this.alarmBeepInterval = setInterval(() => {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = 800;
                oscillator.type = 'sine';

                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
            }, 1500);
            this.updateSilenceButton();
        }
    }

    stopAlarmBeep() {
        if (this.alarmBeepInterval) {
            clearInterval(this.alarmBeepInterval);
            this.alarmBeepInterval = null;
        }
        this.updateSilenceButton();
    }

    silenceAlarms() {
        this.stopAlarmBeep();
    }

    updateSilenceButton() {
        // Show silence button if any alarm is beeping
        const hasBeepingAlarm = this.alarmBeepInterval !== null;
        this.silenceBtn.style.display = hasBeepingAlarm ? 'inline-block' : 'none';
    }

    addAlert(type, message) {
        this.activeAlerts.push({ type, message });
        this.updateAlertBanner();
    }

    removeAlert(type) {
        this.activeAlerts = this.activeAlerts.filter(a => a.type !== type);
        this.updateAlertBanner();
        // Clear alarm status if removing alarm alert
        if (type === 'alarm' && this.activeAlerts.filter(a => a.type === 'alarm').length === 0) {
            this.alarmStatus.textContent = '';
            this.alarmStatus.className = 'status';
        }
        if (type === 'countdown' && this.activeAlerts.filter(a => a.type === 'countdown').length === 0) {
            this.countdownStatus.textContent = '';
            this.countdownStatus.className = 'status';
        }
    }

    updateAlertBanner() {
        if (this.activeAlerts.length > 0) {
            this.alertBanner.textContent = `⏰ ${this.activeAlerts[0].message} (Click to view)`;
            this.alertBanner.style.display = 'block';
        } else {
            this.alertBanner.style.display = 'none';
            this.stopAlarmBeep();
        }
    }    // COUNTDOWN TIMERS
    addTimer() {
        if (!this.timeInput || !this.timeInput.value) {
            this.countdownStatus.textContent = 'Please enter a time';
            this.countdownStatus.className = 'status warning';
            return;
        }

        const { hours, minutes, seconds } = this.parseTimeInput(this.timeInput.value);
        const totalMs = (hours * 3600 + minutes * 60 + seconds) * 1000;

        if (totalMs === 0) {
            this.countdownStatus.textContent = 'Please set a time greater than 0';
            this.countdownStatus.className = 'status warning';
            return;
        }

        const timer = {
            id: this.timerIdCounter++,
            name: this.timerNameInput.value.trim() || `Timer ${this.timerIdCounter}`,
            totalMs: totalMs,
            endTime: Date.now() + totalMs,
            pausedMs: 0,
            running: true,
            paused: false,
            completed: false,
            showElapsed: false
        };

        this.timers.push(timer);
        this.startTimerUpdates();
        this.renderTimers();
        this.saveToLocalStorage();

        this.timerNameInput.value = '';
        this.countdownStatus.textContent = 'Timer added';
        this.countdownStatus.className = 'status active';
        setTimeout(() => {
            this.countdownStatus.textContent = '';
            this.countdownStatus.className = 'status';
        }, 2000);
    }

    pauseTimer(id) {
        const timer = this.timers.find(t => t.id === id);
        if (timer && timer.running) {
            timer.pausedMs = Math.max(0, timer.endTime - Date.now());
            timer.running = false;
            timer.paused = true;
            this.renderTimers();
            this.saveToLocalStorage();
        }
    }

    resumeTimer(id) {
        const timer = this.timers.find(t => t.id === id);
        if (timer && timer.paused) {
            timer.endTime = Date.now() + timer.pausedMs;
            timer.running = true;
            timer.paused = false;
            this.startTimerUpdates();
            this.renderTimers();
            this.saveToLocalStorage();
        }
    }

    dismissTimer(id) {
        const timer = this.timers.find(t => t.id === id);
        if (timer) {
            timer.sounding = false;
            timer.completed = false;
            // Delete the timer after dismissing
            this.timers = this.timers.filter(t => t.id !== id);
        }
        this.removeAlert('countdown');
        this.stopAlarmBeep();
        this.renderTimers();
        this.saveToLocalStorage();
        if (this.timers.length === 0) {
            this.countdownStatus.textContent = '';
            this.countdownStatus.className = 'status';
        }
    }

    restartTimer(id) {
        const timer = this.timers.find(t => t.id === id);
        if (timer) {
            timer.sounding = false;
            timer.completed = false;
            timer.running = true;
            timer.paused = false;
            timer.endTime = Date.now() + timer.totalMs;
            this.stopAlarmBeep();
            this.removeAlert('countdown');
            this.startTimerUpdates();
            this.renderTimers();
            this.saveToLocalStorage();
        }
    }

    deleteTimer(id) {
        this.timers = this.timers.filter(t => t.id !== id);
        this.removeAlert('countdown');
        this.stopAlarmBeep();
        this.renderTimers();
        this.saveToLocalStorage();
        if (this.timers.length === 0) {
            this.countdownStatus.textContent = '';
            this.countdownStatus.className = 'status';
        }
    }

    updateAllTimers() {
        const now = Date.now();
        let hasActiveTimers = false;

        this.timers.forEach(timer => {
            if (timer.running || timer.sounding) {
                hasActiveTimers = true;
                const remaining = Math.max(0, timer.endTime - now);

                if (remaining === 0 && !timer.completed) {
                    timer.completed = true;
                    timer.sounding = true;
                    timer.running = false;
                    timer.completionTime = now;
                    this.playSound(true);

                    const timerName = timer.name || 'Timer';
                    this.countdownStatus.textContent = `⏰ ${timerName} complete!`;
                    this.countdownStatus.className = 'status warning';

                    this.addAlert('countdown', `${timerName} complete!`);

                    if (Notification.permission === 'granted') {
                        new Notification('Timer Complete!', {
                            body: `${timerName} has finished.`,
                            icon: '⏰'
                        });
                    }
                    this.renderTimers();
                }
            }
        });

        this.updateTimerDisplays();

        if (!hasActiveTimers && this.timerUpdateInterval) {
            clearInterval(this.timerUpdateInterval);
            this.timerUpdateInterval = null;
            if (this.timerSaveInterval) {
                clearInterval(this.timerSaveInterval);
                this.timerSaveInterval = null;
            }
        }
    }

    updateTimerDisplays() {
        const now = Date.now();
        const timerItems = this.timerList.querySelectorAll('.timer-item');

        timerItems.forEach((item, index) => {
            const timer = this.timers[index];
            if (!timer) return;

            let remainingMs;
            if (timer.running) {
                remainingMs = Math.max(0, timer.endTime - now);
            } else if (timer.paused) {
                remainingMs = timer.pausedMs;
            } else if (timer.sounding && timer.completionTime) {
                // Show time since completion
                remainingMs = 0;
            } else {
                remainingMs = 0;
            }

            const hours = Math.floor(remainingMs / 3600000);
            const minutes = Math.floor((remainingMs % 3600000) / 60000);
            const seconds = Math.floor((remainingMs % 60000) / 1000);

            const elapsedMs = timer.totalMs - remainingMs;
            const elapsedHours = Math.floor(elapsedMs / 3600000);
            const elapsedMinutes = Math.floor((elapsedMs % 3600000) / 60000);
            const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);

            let displayTime;
            let statusText;

            if (timer.sounding && timer.completionTime) {
                if (timer.showElapsed) {
                    // Show total elapsed time including time since completion
                    const timeSince = now - timer.completionTime;
                    const totalElapsed = timer.totalMs + timeSince;
                    const totalElapsedHours = Math.floor(totalElapsed / 3600000);
                    const totalElapsedMinutes = Math.floor((totalElapsed % 3600000) / 60000);
                    const totalElapsedSeconds = Math.floor((totalElapsed % 60000) / 1000);
                    displayTime = this.formatTime(totalElapsedHours, totalElapsedMinutes, totalElapsedSeconds);
                    statusText = 'Complete!';
                } else {
                    // Show time since timer went off
                    const timeSince = now - timer.completionTime;
                    const sinceHours = Math.floor(timeSince / 3600000);
                    const sinceMinutes = Math.floor((timeSince % 3600000) / 60000);
                    const sinceSeconds = Math.floor((timeSince % 60000) / 1000);
                    displayTime = this.formatTime(sinceHours, sinceMinutes, sinceSeconds);
                    statusText = 'ago';
                }
            } else {
                displayTime = timer.showElapsed ?
                    this.formatTime(elapsedHours, elapsedMinutes, elapsedSeconds) :
                    this.formatTime(hours, minutes, seconds);
                statusText = timer.completed ? 'Complete!' : timer.paused ? 'Paused' : timer.running ? 'Running' : '';
            }

            const timeDisplay = item.querySelector('.timer-time');
            if (timeDisplay) {
                timeDisplay.textContent = `${displayTime} ${statusText ? '- ' + statusText : ''}`;
            }
        });
    }

    startTimerUpdates() {
        if (!this.timerUpdateInterval) {
            this.timerUpdateInterval = setInterval(() => this.updateAllTimers(), 100);
        }
        if (!this.timerSaveInterval) {
            this.timerSaveInterval = setInterval(() => this.saveToLocalStorage(), 5000);
        }
    }

    updateTimerDisplay(timerId, remainingMs) {
        const timer = this.timers.find(t => t.id === timerId);
        if (!timer) return;

        const timeDisplay = this.timerList.querySelector(`.timer-time-display[data-timer-id="${timerId}"]`);
        if (!timeDisplay) return;

        const hours = Math.floor(remainingMs / 3600000);
        const minutes = Math.floor((remainingMs % 3600000) / 60000);
        const seconds = Math.floor((remainingMs % 60000) / 1000);

        const elapsedMs = timer.totalMs - remainingMs;
        const elapsedHours = Math.floor(elapsedMs / 3600000);
        const elapsedMinutes = Math.floor((elapsedMs % 3600000) / 60000);
        const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);

        const displayTime = timer.showElapsed ?
            this.formatTime(elapsedHours, elapsedMinutes, elapsedSeconds) :
            this.formatTime(hours, minutes, seconds);

        const statusText = timer.running ? 'Running' : '';
        timeDisplay.querySelector('.timer-time').textContent = `${displayTime}${statusText ? ' - ' + statusText : ''}`;
    }

    renderTimers() {
        if (this.timers.length === 0) {
            this.timerList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No timers set</div>';
            return;
        }

        const now = Date.now();
        const html = this.timers.map(timer => {
            let remainingMs;
            let className;

            if (timer.running) {
                remainingMs = Math.max(0, timer.endTime - now);
                className = 'timer-item running';
            } else if (timer.paused) {
                remainingMs = timer.pausedMs;
                className = 'timer-item paused';
            } else if (timer.sounding) {
                remainingMs = 0;
                className = 'timer-item sounding';
            } else {
                remainingMs = 0;
                className = 'timer-item';
            }

            const hours = Math.floor(remainingMs / 3600000);
            const minutes = Math.floor((remainingMs % 3600000) / 60000);
            const seconds = Math.floor((remainingMs % 60000) / 1000);

            const totalHours = Math.floor(timer.totalMs / 3600000);
            const totalMinutes = Math.floor((timer.totalMs % 3600000) / 60000);
            const totalSeconds = Math.floor((timer.totalMs % 60000) / 1000);

            const elapsedMs = timer.totalMs - remainingMs;
            const elapsedHours = Math.floor(elapsedMs / 3600000);
            const elapsedMinutes = Math.floor((elapsedMs % 3600000) / 60000);
            const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);

            let displayTime;
            let statusText;

            if (timer.sounding && timer.completionTime) {
                if (timer.showElapsed) {
                    // Show total elapsed time including time since completion
                    const timeSince = now - timer.completionTime;
                    const totalElapsed = timer.totalMs + timeSince;
                    const totalElapsedHours = Math.floor(totalElapsed / 3600000);
                    const totalElapsedMinutes = Math.floor((totalElapsed % 3600000) / 60000);
                    const totalElapsedSeconds = Math.floor((totalElapsed % 60000) / 1000);
                    displayTime = this.formatTime(totalElapsedHours, totalElapsedMinutes, totalElapsedSeconds);
                    statusText = 'Complete!';
                } else {
                    // Show time since timer went off
                    const timeSince = now - timer.completionTime;
                    const sinceHours = Math.floor(timeSince / 3600000);
                    const sinceMinutes = Math.floor((timeSince % 3600000) / 60000);
                    const sinceSeconds = Math.floor((timeSince % 60000) / 1000);
                    displayTime = this.formatTime(sinceHours, sinceMinutes, sinceSeconds);
                    statusText = 'ago';
                }
            } else {
                displayTime = timer.showElapsed ?
                    this.formatTime(elapsedHours, elapsedMinutes, elapsedSeconds) :
                    this.formatTime(hours, minutes, seconds);
                statusText = timer.completed ? 'Complete!' : timer.paused ? 'Paused' : timer.running ? 'Running' : '';
            }

            return `
                <div class="${className}">
                    <div class="timer-info">
                        <div class="timer-name">${timer.name}${timer.sounding ? ' 🔔' : ''}</div>
                        <div class="timer-time-display" data-timer-id="${timer.id}" title="Click to toggle elapsed/remaining">
                            <div class="timer-time">${displayTime} ${statusText ? '- ' + statusText : ''}</div>
                            <div class="timer-initial">Total: ${this.formatTime(totalHours, totalMinutes, totalSeconds)}</div>
                        </div>
                    </div>
                    <div class="item-controls">
                        ${timer.running ? `<button class="btn-stop timer-btn" data-timer-id="${timer.id}" data-action="pause">Pause</button>` : ''}
                        ${timer.paused ? `<button class="btn-start timer-btn" data-timer-id="${timer.id}" data-action="resume">Resume</button>` : ''}
                        ${timer.sounding ? `
                            <button class="btn-start timer-btn" data-timer-id="${timer.id}" data-action="restart">Restart</button>
                            <button class="btn-dismiss timer-btn" data-timer-id="${timer.id}" data-action="dismiss">Dismiss</button>
                        ` : `<button class="btn-stop timer-btn" data-timer-id="${timer.id}" data-action="delete">Delete</button>`}
                    </div>
                </div>
            `;
        }).join('');

        this.timerList.innerHTML = html;
    }

    // STOPWATCH
    updateStopwatchDisplay() {
        // Safety check: ensure we have a valid start time when running
        if (!this.stopwatchRunning || !this.stopwatchStartTime) {
            // If not running properly, just display the base elapsed time
            const hours = Math.floor(this.stopwatchBaseElapsed / 3600000);
            const minutes = Math.floor((this.stopwatchBaseElapsed % 3600000) / 60000);
            const seconds = Math.floor((this.stopwatchBaseElapsed % 60000) / 1000);
            const ms = this.stopwatchBaseElapsed % 1000;
            this.stopwatchDisplay.textContent = this.formatTimeMs(hours, minutes, seconds, ms);
            return;
        }

        const elapsed = this.stopwatchBaseElapsed + (Date.now() - this.stopwatchStartTime);
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        const ms = elapsed % 1000;
        this.stopwatchDisplay.textContent = this.formatTimeMs(hours, minutes, seconds, ms);
    }

    startStopwatch() {
        this.stopwatchStartTime = Date.now();
        this.stopwatchRunning = true;

        // Ensure display timer is running
        if (this.stopwatchTimer) {
            clearInterval(this.stopwatchTimer);
        }
        this.stopwatchTimer = setInterval(() => this.updateStopwatchDisplay(), 10);

        this.stopwatchStart.style.display = 'none';
        this.stopwatchStop.style.display = '';
        this.stopwatchLap.disabled = false;

        // Save immediately when starting to claim this tab as active
        this.saveToLocalStorage();

        // Save periodically while running - always start this to be the active tab
        if (this.stopwatchSaveInterval) {
            clearInterval(this.stopwatchSaveInterval);
        }
        this.stopwatchSaveInterval = setInterval(() => this.saveToLocalStorage(), 5000);
    }

    stopStopwatch() {
        // First, update base elapsed time if running
        if (this.stopwatchRunning && this.stopwatchStartTime) {
            this.stopwatchBaseElapsed += Date.now() - this.stopwatchStartTime;
            this.stopwatchRunning = false;
            this.stopwatchStartTime = null;
        }

        // Then clear the timer
        if (this.stopwatchTimer) {
            clearInterval(this.stopwatchTimer);
            this.stopwatchTimer = null;
        }

        this.stopwatchStart.style.display = '';
        this.stopwatchStop.style.display = 'none';
        this.stopwatchLap.disabled = true;

        // Clear periodic save
        if (this.stopwatchSaveInterval) {
            clearInterval(this.stopwatchSaveInterval);
            this.stopwatchSaveInterval = null;
        }

        this.saveToLocalStorage();
    } resetStopwatch() {
        this.stopStopwatch();
        this.stopwatchBaseElapsed = 0;
        this.stopwatchDisplay.textContent = '00:00:00.000';
        this.lapTimes.innerHTML = '';
        this.lapCounter = 0;
        this.saveToLocalStorage();
    }

    recordLap() {
        // Only record lap if stopwatch is actually running
        if (!this.stopwatchRunning || !this.stopwatchStartTime) {
            return;
        }

        this.lapCounter++;
        const elapsed = this.stopwatchBaseElapsed + (Date.now() - this.stopwatchStartTime);
        const hours = Math.floor(elapsed / 3600000);
        const minutes = Math.floor((elapsed % 3600000) / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        const ms = elapsed % 1000;

        const lapItem = document.createElement('div');
        lapItem.className = 'lap-item';
        lapItem.innerHTML = `
            <span class="lap-number">Lap ${this.lapCounter}</span>
            <span class="lap-time">${this.formatTimeMs(hours, minutes, seconds, ms)}</span>
        `;

        this.lapTimes.insertBefore(lapItem, this.lapTimes.firstChild);
    }

    // ALARMS
    addAlarm() {
        const timeValue = this.alarmTimeInput.value;
        if (!timeValue) {
            this.alarmStatus.textContent = 'Please select a time';
            this.alarmStatus.className = 'status warning';
            return;
        }

        const [hourStr, minuteStr] = timeValue.split(':');
        const hour = parseInt(hourStr);
        const minute = parseInt(minuteStr);
        const label = this.alarmLabelInput.value.trim();
        const repeat = false; // Default to one-time alarm

        this.alarms.push({
            id: Date.now(),
            hour,
            minute,
            label,
            repeat,
            active: true,
            triggered: false
        });

        this.renderAlarms();
        this.startAlarmCheck();
        this.saveToLocalStorage();

        this.alarmStatus.textContent = 'Alarm added successfully';
        this.alarmStatus.className = 'status active';
        setTimeout(() => {
            this.alarmStatus.textContent = '';
            this.alarmStatus.className = 'status';
        }, 2000);

        this.alarmLabelInput.value = '';
    }

    dismissAlarm(id) {
        const alarm = this.alarms.find(a => a.id === id);
        if (alarm) {
            alarm.sounding = false;
            // If it's a one-time alarm, delete it after dismissing
            if (!alarm.repeat) {
                this.alarms = this.alarms.filter(a => a.id !== id);
            }
        }
        this.removeAlert('alarm');
        this.stopAlarmBeep();
        this.renderAlarms();
        this.saveToLocalStorage();
        if (this.alarms.length === 0) {
            this.alarmStatus.textContent = '';
            this.alarmStatus.className = 'status';
        }
    }

    restartAlarm(id) {
        const alarm = this.alarms.find(a => a.id === id);
        if (alarm) {
            // Convert to repeating alarm
            alarm.repeat = true;
            alarm.sounding = false;
            alarm.triggered = false;
            this.stopAlarmBeep();
            this.removeAlert('alarm');
            this.renderAlarms();
            this.saveToLocalStorage();

            this.alarmStatus.textContent = `Alarm converted to repeating`;
            this.alarmStatus.className = 'status success';
            setTimeout(() => {
                this.alarmStatus.textContent = '';
                this.alarmStatus.className = 'status';
            }, 2000);
        }
    }

    deleteAlarm(id) {
        this.alarms = this.alarms.filter(a => a.id !== id);
        this.removeAlert('alarm');
        this.stopAlarmBeep();
        this.renderAlarms();
        this.saveToLocalStorage();

        if (this.alarms.length === 0 && this.alarmCheckInterval) {
            clearInterval(this.alarmCheckInterval);
            this.alarmCheckInterval = null;
        }
    }

    toggleAlarmRepeat(id) {
        const alarm = this.alarms.find(a => a.id === id);
        if (alarm) {
            alarm.repeat = !alarm.repeat;
            this.renderAlarms();
            this.saveToLocalStorage();
        }
    }

    getTimeUntilAlarm(alarm) {
        const now = new Date();
        const alarmTime = new Date();
        alarmTime.setHours(alarm.hour, alarm.minute, 0, 0);

        if (alarmTime <= now) {
            alarmTime.setDate(alarmTime.getDate() + 1);
        }

        const diff = alarmTime - now;
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);

        if (hours > 0) {
            return `in ${hours}h ${minutes}m`;
        } else {
            return `in ${minutes}m`;
        }
    }

    checkAlarms() {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        this.alarms.forEach(alarm => {
            if (alarm.active && alarm.hour === currentHour && alarm.minute === currentMinute && !alarm.triggered) {
                alarm.triggered = true;
                alarm.sounding = true;
                this.playSound(true);

                this.alarmStatus.textContent = `⏰ Alarm: ${alarm.label || 'Alarm triggered!'}`;
                this.alarmStatus.className = 'status warning';

                this.addAlert('alarm', alarm.label || 'Alarm triggered!');

                if (Notification.permission === 'granted') {
                    new Notification('Alarm!', {
                        body: alarm.label || `Alarm set for ${this.formatTime12Hour(alarm.hour, alarm.minute)}`,
                        icon: '⏰',
                        requireInteraction: true
                    });
                }

                // Reset triggered flag after 1 minute for repeating alarms
                setTimeout(() => {
                    alarm.triggered = false;
                }, 60000);
            }
        });

        this.renderAlarms();
    }

    startAlarmCheck() {
        if (!this.alarmCheckInterval) {
            this.alarmCheckInterval = setInterval(() => this.checkAlarms(), 1000);
        }
    }

    renderAlarms() {
        if (this.alarms.length === 0) {
            this.alarmList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">No alarms set</div>';
            return;
        }

        const html = this.alarms.map(alarm => {
            const timeUntil = this.getTimeUntilAlarm(alarm);
            const timeDisplay = this.formatTime12Hour(alarm.hour, alarm.minute);
            const isSounding = alarm.sounding;
            const isOneTime = !alarm.repeat;
            return `
                <div class="alarm-item ${alarm.active ? 'active' : ''} ${isSounding ? 'sounding' : ''}">
                    <div class="alarm-info">
                        <div class="alarm-time">${timeDisplay}</div>
                        <div class="alarm-label">${alarm.label || 'Alarm'}${isSounding ? ' 🔔' : ''}</div>
                        <div class="alarm-countdown">${timeUntil} | <span class="alarm-repeat-toggle" data-alarm-id="${alarm.id}" title="Click to toggle">${alarm.repeat ? 'Repeating' : 'One-time'}</span></div>
                    </div>
                    <div class="item-controls">
                        ${isSounding && isOneTime ? `<button class="btn-start timer-btn" data-alarm-id="${alarm.id}" data-action="restart">Restart</button>` : ''}
                        ${isSounding ? `<button class="btn-dismiss timer-btn" data-alarm-id="${alarm.id}" data-action="dismiss">Dismiss</button>` : ''}
                        ${!isSounding ? `<button class="btn-stop timer-btn" data-alarm-id="${alarm.id}" data-action="delete">Delete</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        this.alarmList.innerHTML = html;
    }

    // CLOCK VIEW
    updateClock() {
        const now = new Date();
        const hours24 = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        // Convert to 12-hour format
        const period = hours24 >= 12 ? 'PM' : 'AM';
        const hours12 = hours24 % 12 || 12;

        // Show or hide seconds based on user preference
        if (this.showClockSeconds) {
            this.clockDisplay.textContent = `${this.formatTime(hours12, minutes, seconds)} ${period}`;
        } else {
            this.clockDisplay.textContent = this.formatTime12Hour(hours24, minutes);
        }

        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        this.clockDate.textContent = now.toLocaleDateString('en-US', options);

        // Update active items
        this.updateActiveItems();
    }

    updateActiveItems() {
        // Active timers
        const runningTimers = this.timers.filter(t => t.running || t.paused);
        if (runningTimers.length > 0) {
            const now = Date.now();
            this.activeTimersDisplay.innerHTML = '<h4>Countdown Timers</h4>' + runningTimers.map(timer => {
                const remainingMs = timer.running ? Math.max(0, timer.endTime - now) : timer.pausedMs;
                const hours = Math.floor(remainingMs / 3600000);
                const minutes = Math.floor((remainingMs % 3600000) / 60000);
                const seconds = Math.floor((remainingMs % 60000) / 1000);
                return `<div class="active-item" data-goto-tab="countdown">
                    <span>${timer.name}</span>
                    <span>${this.formatTime(hours, minutes, seconds)}</span>
                </div>`;
            }).join('');
        } else {
            this.activeTimersDisplay.innerHTML = '';
        }

        // Active stopwatch
        if (this.stopwatchRunning || this.stopwatchBaseElapsed > 0) {
            let elapsed;
            if (this.stopwatchRunning && this.stopwatchStartTime) {
                elapsed = this.stopwatchBaseElapsed + (Date.now() - this.stopwatchStartTime);
            } else {
                elapsed = this.stopwatchBaseElapsed;
            }
            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            const ms = elapsed % 1000;

            this.activeStopwatchesDisplay.innerHTML = `<h4>Stopwatch</h4>
                <div class="active-item" data-goto-tab="stopwatch">
                    <span>Stopwatch</span>
                    <span>${this.formatTimeMs(hours, minutes, seconds, ms)}</span>
                </div>`;
        } else {
            this.activeStopwatchesDisplay.innerHTML = '';
        }

        // Active alarms
        if (this.alarms.length > 0) {
            this.activeAlarmsDisplay.innerHTML = '<h4>Alarms</h4>' + this.alarms.map(alarm => {
                const timeDisplay = this.formatTime12Hour(alarm.hour, alarm.minute);
                const timeUntil = this.getTimeUntilAlarm(alarm);
                return `<div class="active-item" data-goto-tab="alarm">
                    <span>${alarm.label || 'Alarm'} - ${timeDisplay}</span>
                    <span>${timeUntil}</span>
                </div>`;
            }).join('');
        } else {
            this.activeAlarmsDisplay.innerHTML = '';
        }

        // Hide "Active Items" section if nothing is active
        const activeItemsSection = document.querySelector('.active-items-section');
        const hasActiveItems = runningTimers.length > 0 ||
            this.stopwatchRunning ||
            this.stopwatchBaseElapsed > 0 ||
            this.alarms.length > 0;

        if (activeItemsSection) {
            activeItemsSection.style.display = hasActiveItems ? 'block' : 'none';
        }
    }

    startClockUpdate() {
        this.updateClock();
        if (!this.clockUpdateInterval) {
            this.clockUpdateInterval = setInterval(() => this.updateClock(), 1000);
        }
    }

    stopClockUpdate() {
        if (this.clockUpdateInterval) {
            clearInterval(this.clockUpdateInterval);
            this.clockUpdateInterval = null;
        }
    }
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new TimerApp();
});
