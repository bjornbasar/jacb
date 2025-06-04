module.exports = function getStandardReply(message, channel = null) {
    const lower = message.trim().toLowerCase();

    if (/\b(hi|hello)\b/.test(lower)) {
        return 'Hey there! 👋 How can I help you today?';
    }

    if (/\b(help|support)\b/.test(lower)) {
        let reply = 'I can help answer questions, offer basic replies, or just chat.';
        if (channel === 'telegram') {
            reply += ' Try typing `/gh <repo>` to check GitHub status or `/gh audit` for org logs.';
        }
        return reply;
    }

    if (/\b(bye|goodbye|see ya)\b/.test(lower)) {
        return 'Goodbye! 👋 Come back anytime.';
    }

    if (/\b(thanks|thank you)\b/.test(lower)) {
        return 'You’re welcome! 😊';
    }

    return null;
};
