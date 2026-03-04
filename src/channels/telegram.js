import { sanitizeInput, isValidTelegramUpdate, fetchJSON } from '../lib/utils.js';
import getStandardReply from '../handlers/standard.js';
import getOpenAIResponse from '../lib/openai.js';
import handleTelegramCmds from '../handlers/telegramCmds.js';

const TG_TOKEN = process.env.TG_TOKEN;

const DEFAULT_RESPONSES = [
    "I'm not sure how to respond to that yet, but I'm learning! 🤖",
    "That's interesting! I'm still learning how to respond to that. 🤔",
    "I'm working on understanding that better. Thanks for your patience! 🙏",
    "I don't have a response for that right now, but I'm constantly improving! 🚀",
];

export default async function telegramRoutes(fastify, _opts) {
    fastify.post(
        '/webhook/telegram',
        { config: { rateLimit: { max: 30, timeWindow: 1000 } } },
        async (request, reply) => {
            const update = request.body;

            if (!isValidTelegramUpdate(update)) {
                fastify.log.warn({ update }, 'Invalid Telegram update');
                return reply.code(200).send();
            }

            const chatId = update.message.chat.id;
            const senderId = update.message.from.id;
            const text = sanitizeInput(update.message.text);

            try {
                const parts = text.split(/\s+/);
                let reply_text;

                if (parts[0].startsWith('/')) {
                    reply_text = await handleTelegramCmds(senderId, parts);
                }

                if (!reply_text) {
                    reply_text = getStandardReply(text, 'telegram');
                }

                if (!reply_text) {
                    reply_text = await getOpenAIResponse(text);
                }

                if (!reply_text) {
                    reply_text = DEFAULT_RESPONSES[Math.floor(Math.random() * DEFAULT_RESPONSES.length)];
                }

                await sendTelegramMessage(chatId, reply_text);
            } catch (err) {
                fastify.log.error({ err, chatId }, 'Telegram handler error');
            }

            return reply.code(200).send();
        }
    );
}

async function sendTelegramMessage(chatId, text) {
    const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
    const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' });

    const res = await fetchJSON(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
    });

    if (!res.ok) {
        if (res.status === 400) {
            // Fallback: retry without Markdown
            await fetchJSON(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: chatId, text }),
            });
        } else {
            throw Object.assign(new Error('Telegram sendMessage failed'), { status: res.status });
        }
    }
}
