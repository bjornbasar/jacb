// index.js
const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const telegramHandler = require('./channels/telegram');
const messengerHandler = require('./channels/messenger');
const { createRateLimiter, validateEnvVars, HTTP_STATUS } = require('./core/utils');

// Validate environment variables on startup
try {
    validateEnvVars();
    console.log('✅ Environment variables validated');
} catch (error) {
    console.error('❌ Environment validation failed:', error.message);
    process.exit(1);
}

const app = express();

// Security middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Body parser with size limits
app.use(bodyParser.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
        // Store raw body for webhook verification if needed
        req.rawBody = buf;
    }
}));

// Rate limiters
const telegramLimiter = createRateLimiter(30, 1000); // 30 requests per second
const messengerLimiter = createRateLimiter(100, 1000); // 100 requests per second

// Rate limiting middleware
function createRateLimit(limiter, service) {
    return (req, res, next) => {
        const identifier = req.ip || 'unknown';
        
        if (!limiter(identifier)) {
            console.warn(`Rate limit exceeded for ${service} from ${identifier}`);
            return res.status(429).json({ 
                error: 'Rate limit exceeded',
                service,
                retry_after: 1
            });
        }
        
        next();
    };
}

// Telegram Webhook
app.post('/webhook/telegram', createRateLimit(telegramLimiter, 'telegram'), telegramHandler.handle);

// Messenger Webhook
app.get('/webhook/messenger', messengerHandler.verify);
app.post('/webhook/messenger', createRateLimit(messengerLimiter, 'messenger'), messengerHandler.handle);

// Health check endpoint
app.get('/', (req, res) => {
    res.status(HTTP_STATUS.OK).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Unhandled error:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method
    });
    
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({ 
        error: 'Internal server error' 
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Bot server running on port ${PORT}`);
    console.log(`📊 Process ID: ${process.pid}`);
    console.log(`🔄 Node version: ${process.version}`);
});
