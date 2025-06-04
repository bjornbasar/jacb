const getOpenAIResponse = require('./openaiResponder');
const handleTelegramCommands = require('./telegramCommands');
const getStandardReply = require('./standardReplies');

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

    const standardReply = getStandardReply(message, channel);
    if (standardReply) return standardReply;

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
