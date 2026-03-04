import handleGhCommand from './github.js';

const ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;

export default async function handleTelegramCmds(senderId, parts) {
    console.log(`Received command from ${senderId}: ${parts.join(' ')}`);
    if (senderId.toString() !== ADMIN_ID) {
        return '🚫 You are not authorized to use bot commands.';
    }

    const cmd = parts[0];
    const args = parts.slice(1);

    switch (cmd) {
        case '/gh':
            return await handleGhCommand(args);
        case '/help':
            return 'I can help answer questions, offer basic replies, or just chat. Try `/gh <repo>` to check GitHub status or `/gh audit` for org logs.';
        default:
            return null;
    }
}
