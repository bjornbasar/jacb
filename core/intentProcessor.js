const getOpenAIResponse = require('./openaiResponder');
const handleTelegramCommands = require('./telegramCommands');
const getStandardReply = require('./standardReplies');
const { sanitizeInput } = require('./utils');

// Cache for frequently used responses
const responseCache = new Map();
const CACHE_TTL = 300000; // 5 minutes

module.exports = async function handleMessage(senderId, message, channel = null) {
    try {
        const sanitizedMessage = sanitizeInput(message);
        if (!sanitizedMessage) {
            return "I didn't receive a valid message. Please try again.";
        }

        const parts = sanitizedMessage.split(/\s+/);
        const command = parts[0];
        const lower = sanitizedMessage.toLowerCase();

        // Generate cache key for non-command messages
        const cacheKey = channel !== 'telegram' || !command.startsWith('/') 
            ? `${channel}:${lower}` 
            : null;

        // Check cache for non-command messages
        if (cacheKey && responseCache.has(cacheKey)) {
            const cached = responseCache.get(cacheKey);
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                return cached.response;
            }
            responseCache.delete(cacheKey);
        }

        let response;

        // Telegram command handling
        if (channel === 'telegram' && command.startsWith('/')) {
            response = await handleTelegramCommands(senderId, sanitizedMessage, parts);
            if (response) return response;
        }

        // Standard replies (fast path)
        response = getStandardReply(sanitizedMessage, channel);
        if (response) {
            if (cacheKey) cacheResponse(cacheKey, response);
            return response;
        }

        // OpenAI fallback
        response = await getOpenAIResponse(sanitizedMessage);
        if (response) {
            if (cacheKey) cacheResponse(cacheKey, response);
            return response;
        }

        // Default response
        response = getRandomDefaultResponse();
        if (cacheKey) cacheResponse(cacheKey, response);
        return response;

    } catch (error) {
        console.error('Intent processor error:', {
            senderId,
            message: message?.substring(0, 100),
            channel,
            error: error.message
        });
        
        return "Something went wrong while processing your message. Please try again.";
    }
};

function cacheResponse(key, response) {
    responseCache.set(key, {
        response,
        timestamp: Date.now()
    });

    // Clean up old cache entries periodically
    if (responseCache.size > 1000) {
        const cutoff = Date.now() - CACHE_TTL;
        for (const [key, value] of responseCache.entries()) {
            if (value.timestamp < cutoff) {
                responseCache.delete(key);
            }
        }
    }
}

function getRandomDefaultResponse() {
    const responses = [
        "I'm not sure how to respond to that yet, but I'm learning! 🤖",
        "That's interesting! I'm still learning how to respond to that. 🤔",
        "I'm working on understanding that better. Thanks for your patience! 🙏",
        "I don't have a response for that right now, but I'm constantly improving! 🚀"
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
}
