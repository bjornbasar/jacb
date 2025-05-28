let openai;

if (process.env.USE_OPENAI === 'true') {
    const { OpenAI } = require('openai');
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

module.exports = async function getOpenAIResponse(message) {
    if (!openai) return null;

    try {
        const response = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'You are a helpful assistant chatbot.' },
                { role: 'user', content: message }
            ],
            max_tokens: 200,
            temperature: 0.7
        });

        return response.choices?.[0]?.message?.content?.trim() || null;
    } catch (err) {
        console.error('OpenAI error:', err);
        return null;
    }
};
