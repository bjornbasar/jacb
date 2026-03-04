// telegramCommands.js
const TELEGRAM_ADMIN_ID = process.env.TELEGRAM_ADMIN_ID;
const handleGhCommand = require('./telegram/ghCommands');
const handleHelpCommand = require('./telegram/helpCommand');

module.exports = async function handleTelegramCommands(senderId, message, parts) {
  const cmd = parts[0];
  const args = parts.slice(1);

  // 🔒 Restrict access to Telegram admin
  if (senderId.toString() !== TELEGRAM_ADMIN_ID) {
    return '🚫 You are not authorized to use GitHub commands.';
  }

  switch (cmd) {
    case '/gh':
      return await handleGhCommand(args);
    case '/help':
      return await handleHelpCommand();
    default:
      return null; // unknown command
  }
};
