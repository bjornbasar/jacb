const { sanitizeInput } = require('./utils');

let openai;

if (process.env.USE_OPENAI === 'true') {
    if (!process.env.OPENAI_API_KEY) {
        console.warn('OpenAI enabled but OPENAI_API_KEY not provided');
    } else {
        try {
            const { OpenAI } = require('openai');
            openai = new OpenAI({ 
                apiKey: process.env.OPENAI_API_KEY,
                timeout: 10000,
                maxRetries: 2
            });
        } catch (error) {
            console.error('Failed to initialize OpenAI:', error);
        }
    }
}

module.exports = async function getOpenAIResponse(message) {
    if (!openai) return null;

    const sanitizedMessage = sanitizeInput(message);
    if (!sanitizedMessage) return null;

    try {
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            messages: [
                { 
                    role: 'system', 
                    content: 'You are a helpful assistant chatbot. Keep responses concise and friendly.'
                },
                { role: 'user', content: sanitizedMessage }
            ],
            max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 200,
            temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7
        });

        return response.choices?.[0]?.message?.content?.trim() || null;
    } catch (err) {
        console.error('OpenAI error:', {
            message: err.message,
            type: err.type,
            code: err.code
        });
        
        // Return a fallback message for certain error types
        if (err.type === 'insufficient_quota') {
            return 'I\'m currently unable to respond due to usage limits. Please try again later.';
        }
        
        return null;
    }
};
