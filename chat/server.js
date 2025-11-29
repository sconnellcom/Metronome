/**
 * Group Chat WebSocket Server
 * 
 * A simple WebSocket server for the group chat application.
 * Handles user connections, message broadcasting, and user count updates.
 * 
 * Usage:
 *   npm install ws
 *   node server.js
 * 
 * The server will start on port 3000 by default.
 * Set the PORT environment variable to use a different port.
 */

const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const MAX_MESSAGE_LENGTH = 500;
const MAX_USERNAME_LENGTH = 20;
const MAX_HISTORY_LENGTH = 50;

// Store connected clients and message history
const clients = new Map();
const messageHistory = [];

// Create WebSocket server
const wss = new WebSocket.Server({ port: PORT });

console.log(`Chat server running on port ${PORT}`);

wss.on('connection', (ws) => {
    let username = null;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            handleMessage(ws, message, () => username, (name) => { username = name; });
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        if (username) {
            clients.delete(ws);
            broadcast({
                type: 'system',
                content: `${username} left the chat`
            });
            broadcastUserCount();
            console.log(`${username} disconnected`);
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

function handleMessage(ws, message, getUsername, setUsername) {
    switch (message.type) {
        case 'join':
            handleJoin(ws, message, setUsername);
            break;
        case 'chat':
            handleChat(ws, message, getUsername);
            break;
        default:
            console.log('Unknown message type:', message.type);
    }
}

function handleJoin(ws, message, setUsername) {
    let username = sanitizeUsername(message.username);
    
    if (!username) {
        ws.send(JSON.stringify({
            type: 'system',
            content: 'Invalid username. Please use only letters, numbers, and underscores.'
        }));
        return;
    }

    // Check for duplicate usernames
    let uniqueUsername = username;
    let counter = 1;
    while (Array.from(clients.values()).includes(uniqueUsername)) {
        uniqueUsername = `${username}_${counter}`;
        counter++;
    }
    username = uniqueUsername;

    setUsername(username);
    clients.set(ws, username);

    // Send welcome message
    ws.send(JSON.stringify({
        type: 'system',
        content: `Welcome to the chat, ${username}!`
    }));

    // Send message history
    if (messageHistory.length > 0) {
        ws.send(JSON.stringify({
            type: 'history',
            messages: messageHistory
        }));
    }

    // Broadcast join notification
    broadcast({
        type: 'system',
        content: `${username} joined the chat`
    }, ws);

    broadcastUserCount();
    console.log(`${username} connected`);
}

function handleChat(ws, message, getUsername) {
    const username = getUsername();
    if (!username) {
        ws.send(JSON.stringify({
            type: 'system',
            content: 'Please join the chat first'
        }));
        return;
    }

    const content = sanitizeMessage(message.content);
    if (!content) {
        return;
    }

    const chatMessage = {
        type: 'chat',
        username: username,
        content: content,
        timestamp: Date.now()
    };

    // Store in history
    messageHistory.push(chatMessage);
    if (messageHistory.length > MAX_HISTORY_LENGTH) {
        messageHistory.shift();
    }

    // Broadcast to all clients
    broadcast(chatMessage);
}

function broadcast(message, excludeWs = null) {
    const messageStr = JSON.stringify(message);
    wss.clients.forEach((client) => {
        if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

function broadcastUserCount() {
    const count = clients.size;
    broadcast({
        type: 'userCount',
        count: count
    });
}

function sanitizeUsername(username) {
    if (!username || typeof username !== 'string') {
        return null;
    }
    
    // Trim and limit length
    let sanitized = username.trim().substring(0, MAX_USERNAME_LENGTH);
    
    // Only allow alphanumeric characters and underscores
    sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, '');
    
    return sanitized.length > 0 ? sanitized : null;
}

function sanitizeMessage(content) {
    if (!content || typeof content !== 'string') {
        return null;
    }
    
    // Trim and limit length
    let sanitized = content.trim().substring(0, MAX_MESSAGE_LENGTH);
    
    return sanitized.length > 0 ? sanitized : null;
}

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    wss.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\nShutting down server...');
    wss.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
