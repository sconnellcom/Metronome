// Group Chat Application
class ChatApp {
    constructor() {
        this.socket = null;
        this.username = '';
        this.serverUrl = 'ws://localhost:3000';
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;

        this.initializeTheme();
        this.initializeElements();
        this.setupEventListeners();
        this.loadSavedSettings();
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('chatTheme') || 'default';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        document.body.classList.remove(
            'theme-light', 'theme-dark', 'theme-warm-light', 'theme-warm-dark',
            'theme-red', 'theme-pink', 'theme-red-dark', 'theme-pink-dark',
            'theme-black', 'theme-blue', 'theme-blue-dark'
        );

        if (theme !== 'default') {
            document.body.classList.add(`theme-${theme}`);
        }

        const themeBtnActive = document.querySelector('.theme-btn-active');
        if (themeBtnActive) {
            themeBtnActive.className = `theme-btn-active theme-${theme}`;
        }

        localStorage.setItem('chatTheme', theme);
    }

    initializeElements() {
        // Chat elements
        this.messagesArea = document.getElementById('messages');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.userCount = document.getElementById('userCount');

        // Theme elements
        this.themeBtnActive = document.querySelector('.theme-btn-active');
        this.themeDropdown = document.querySelector('.theme-dropdown');

        // Username modal
        this.usernameModal = document.getElementById('usernameModal');
        this.usernameInput = document.getElementById('usernameInput');
        this.joinBtn = document.getElementById('joinBtn');

        // Server config modal
        this.serverModal = document.getElementById('serverModal');
        this.serverInput = document.getElementById('serverInput');
        this.connectBtn = document.getElementById('connectBtn');
    }

    setupEventListeners() {
        // Send message
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Join chat
        this.joinBtn.addEventListener('click', () => this.joinChat());
        this.usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinChat();
            }
        });

        // Server config
        this.connectBtn.addEventListener('click', () => this.connectToServer());
        this.serverInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.connectToServer();
            }
        });

        // Theme picker
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
    }

    loadSavedSettings() {
        // Load saved username
        const savedUsername = localStorage.getItem('chatUsername');
        if (savedUsername) {
            this.usernameInput.value = savedUsername;
        }

        // Load saved server URL
        const savedServerUrl = localStorage.getItem('chatServerUrl');
        if (savedServerUrl) {
            this.serverUrl = savedServerUrl;
        }
        this.serverInput.value = this.serverUrl;
    }

    joinChat() {
        const username = this.usernameInput.value.trim();
        if (!username) {
            this.usernameInput.focus();
            return;
        }

        if (username.length > 20) {
            this.addSystemMessage('Username must be 20 characters or less');
            return;
        }

        this.username = username;
        localStorage.setItem('chatUsername', username);

        this.usernameModal.style.display = 'none';
        this.connect();
    }

    connect() {
        this.setConnectionStatus('connecting');

        try {
            this.socket = new WebSocket(this.serverUrl);

            this.socket.onopen = () => {
                this.reconnectAttempts = 0;
                this.setConnectionStatus('connected');

                // Send join message
                this.socket.send(JSON.stringify({
                    type: 'join',
                    username: this.username
                }));
            };

            this.socket.onmessage = (event) => {
                this.handleMessage(event.data);
            };

            this.socket.onclose = () => {
                this.setConnectionStatus('disconnected');
                this.attemptReconnect();
            };

            this.socket.onerror = () => {
                this.setConnectionStatus('disconnected');
                this.showServerConfig();
            };
        } catch (error) {
            console.error('Connection error:', error);
            this.setConnectionStatus('disconnected');
            this.showServerConfig();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.addSystemMessage('Unable to reconnect. Please refresh the page.');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;

        this.addSystemMessage(`Reconnecting in ${delay / 1000}s...`);

        setTimeout(() => {
            if (!this.socket || this.socket.readyState === WebSocket.CLOSED) {
                this.connect();
            }
        }, delay);
    }

    showServerConfig() {
        this.usernameModal.style.display = 'none';
        this.serverModal.style.display = 'flex';
    }

    connectToServer() {
        const serverUrl = this.serverInput.value.trim();
        if (!serverUrl) {
            this.serverInput.focus();
            return;
        }

        this.serverUrl = serverUrl;
        localStorage.setItem('chatServerUrl', serverUrl);

        this.serverModal.style.display = 'none';

        if (this.username) {
            this.connect();
        } else {
            this.usernameModal.style.display = 'flex';
        }
    }

    setConnectionStatus(status) {
        this.connectionStatus.classList.remove('connected', 'disconnected', 'connecting');
        this.connectionStatus.classList.add(status);

        const titles = {
            'connected': 'Connected',
            'disconnected': 'Disconnected',
            'connecting': 'Connecting...'
        };
        this.connectionStatus.title = titles[status] || 'Unknown';

        // Enable/disable input based on connection
        const isConnected = status === 'connected';
        this.messageInput.disabled = !isConnected;
        this.sendBtn.disabled = !isConnected;
    }

    handleMessage(data) {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case 'chat':
                    this.displayMessage(message);
                    break;
                case 'system':
                    this.addSystemMessage(message.content);
                    break;
                case 'userCount':
                    this.updateUserCount(message.count);
                    break;
                case 'history':
                    this.displayHistory(message.messages);
                    break;
                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }

    displayMessage(message) {
        const isOwn = message.username === this.username;
        const messageEl = document.createElement('div');
        messageEl.className = `message ${isOwn ? 'own' : 'other'}`;

        const time = new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageEl.innerHTML = `
            <div class="message-header">
                <span class="message-username">${this.escapeHtml(message.username)}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-content">${this.escapeHtml(message.content)}</div>
        `;

        this.messagesArea.appendChild(messageEl);
        this.scrollToBottom();
    }

    displayHistory(messages) {
        if (messages && messages.length > 0) {
            messages.forEach(msg => this.displayMessage(msg));
        }
    }

    addSystemMessage(content) {
        const systemEl = document.createElement('div');
        systemEl.className = 'system-message';
        systemEl.textContent = content;

        this.messagesArea.appendChild(systemEl);
        this.scrollToBottom();
    }

    updateUserCount(count) {
        this.userCount.textContent = `${count} online`;
    }

    sendMessage() {
        const content = this.messageInput.value.trim();
        if (!content) return;

        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            this.addSystemMessage('Not connected. Please wait...');
            return;
        }

        // Limit message length
        if (content.length > 500) {
            this.addSystemMessage('Message is too long (max 500 characters)');
            return;
        }

        this.socket.send(JSON.stringify({
            type: 'chat',
            content: content
        }));

        this.messageInput.value = '';
        this.messageInput.focus();
    }

    scrollToBottom() {
        requestAnimationFrame(() => {
            this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the chat app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});
