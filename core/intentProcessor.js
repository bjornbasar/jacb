const getOpenAIResponse = require('./openaiResponder');
const handleTelegramCommands = require('./telegramCommands');

module.exports = async function handleMessage(senderId, message, channel = null) {
    const trimmed = message.trim();
    const parts = trimmed.split(/\s+/);
    const command = parts[0];
    const lower = trimmed.toLowerCase();

    //
    // 🔁 Telegram-specific command handler
    //
    if (channel === 'telegram' && command.startsWith('/')) {
        const cmdResponse = await handleTelegramCommands(senderId, message, parts);
        if (cmdResponse) return cmdResponse;
    }

    //
    // 👋 Keyword responses for all channels
    //
    if (/\b(hi|hello)\b/i.test(lower)) {
        return 'Hey there! 👋 How can I help you today?';
    }

    if (/\b(help|support)\b/i.test(lower)) {
        let response = 'I can help answer questions, offer basic replies, or just chat.';
        if (channel === 'telegram') {
            response += ' Try typing `/gh <repo>` to check GitHub status or `/gh audit` for org logs.';
        }
        return response;
    }

    if (/\b(bye|goodbye|see ya)\b/i.test(lower)) {
        return 'Goodbye! 👋 Come back anytime.';
    }

    if (/\b(thanks|thank you)\b/i.test(lower)) {
        return 'You’re welcome! 😊';
    }

    //
    // 🤖 OpenAI fallback
    //
    const aiReply = await getOpenAIResponse(message);
    if (aiReply) return aiReply;

    //
    // 💬 Default response
    //
    return `I'm not sure how to respond to that yet, but I'm learning! 🤖`;
};
