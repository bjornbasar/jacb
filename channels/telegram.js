// channels/telegram.js
const handleMessage = require('../core/intentProcessor');
const { sanitizeInput, isValidTelegramUpdate, makeHttpRequest, HTTP_STATUS } = require('../core/utils');

const TG_TOKEN = process.env.TG_TOKEN;

if (!TG_TOKEN) {
    throw new Error('TG_TOKEN environment variable is required');
}

exports.handle = async (req, res) => {
    try {
        const update = req.body;

        // Validate incoming update structure
        if (!isValidTelegramUpdate(update)) {
            console.warn('Invalid Telegram update received:', update);
            return res.sendStatus(HTTP_STATUS.OK);
        }

        const chatId = update.message.chat.id;
        const text = sanitizeInput(update.message.text);
        const senderId = update.message.from.id;

        // Process the message
        const reply = await handleMessage(senderId, text, 'telegram');

        // Send response to Telegram
        await sendTelegramMessage(chatId, reply);

        res.sendStatus(HTTP_STATUS.OK);
    } catch (error) {
        console.error('Telegram handler error:', {
            error: error.message,
            stack: error.stack,
            update: req.body
        });
        res.sendStatus(HTTP_STATUS.INTERNAL_ERROR);
    }
};

async function sendTelegramMessage(chatId, text) {
    const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
    
    try {
        await makeHttpRequest(url, {
            method: 'POST',
            data: {
                chat_id: chatId,
                text: text,
                parse_mode: 'Markdown'
            }
        });
    } catch (error) {
        // Fallback to plain text if Markdown parsing fails
        if (error.response?.status === 400) {
            await makeHttpRequest(url, {
                method: 'POST',
                data: {
                    chat_id: chatId,
                    text: text
                }
            });
        } else {
            throw error;
        }
    }
}
