import handleGhCommand from './github.js';
import handleDockerCommand from './docker.js';

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
        case '/docker':
        case '/d':
            return await handleDockerCommand(args);
        case '/help':
            return (
                'Commands:\n' +
                '`/gh` — GitHub status\n' +
                '`/docker` (`/d`) — Docker containers\n' +
                '`/d ps` — running containers\n' +
                '`/d projects` — compose projects\n' +
                '`/d stats` — resource usage\n' +
                '`/d logs <name>` — container logs\n' +
                '`/d restart <name>` — restart container'
            );
        default:
            return null;
    }
}
