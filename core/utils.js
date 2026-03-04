const axios = require('axios');

const HTTP_STATUS = {
    OK: 200,
    BAD_REQUEST: 400,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500
};

const RATE_LIMITS = {
    TELEGRAM_PER_SECOND: 30,
    MESSENGER_PER_SECOND: 100,
    GITHUB_PER_HOUR: 5000
};

function validateEnvVars() {
    const required = ['TG_TOKEN', 'FB_PAGE_TOKEN', 'FB_VERIFY_TOKEN'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

function sanitizeInput(text) {
    if (typeof text !== 'string') return '';
    return text.trim().substring(0, 4096); // Telegram message limit
}

function isValidTelegramUpdate(update) {
    return !!(update && 
              update.message && 
              update.message.text && 
              update.message.chat && 
              update.message.chat.id &&
              update.message.from &&
              update.message.from.id);
}

function isValidMessengerEvent(event) {
    return !!(event &&
              event.sender &&
              event.sender.id &&
              (event.message?.text || event.message?.quick_reply));
}

async function makeHttpRequest(url, options = {}) {
    const defaultOptions = {
        timeout: 10000,
        ...options
    };

    try {
        const response = await axios(url, defaultOptions);
        return response;
    } catch (error) {
        console.error(`HTTP request failed for ${url}:`, {
            status: error.response?.status,
            statusText: error.response?.statusText,
            message: error.message
        });
        throw error;
    }
}

function createRateLimiter(maxRequests, windowMs) {
    const requests = new Map();
    
    return (identifier) => {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        if (!requests.has(identifier)) {
            requests.set(identifier, []);
        }
        
        const userRequests = requests.get(identifier);
        const validRequests = userRequests.filter(time => time > windowStart);
        
        if (validRequests.length >= maxRequests) {
            return false;
        }
        
        validRequests.push(now);
        requests.set(identifier, validRequests);
        return true;
    };
}

module.exports = {
    HTTP_STATUS,
    RATE_LIMITS,
    validateEnvVars,
    sanitizeInput,
    isValidTelegramUpdate,
    isValidMessengerEvent,
    makeHttpRequest,
    createRateLimiter
};