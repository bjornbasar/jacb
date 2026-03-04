import { sanitizeInput, isValidMessengerEvent, fetchJSON } from '../lib/utils.js';
import getStandardReply from '../handlers/standard.js';
import { keywordReply, handleQuickReplyPayload } from '../handlers/messengerReplies.js';

const PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;

export default async function messengerRoutes(fastify, _opts) {
    // Verification handshake
    fastify.get('/webhook/messenger', async (request, reply) => {
        const mode = request.query['hub.mode'];
        const token = request.query['hub.verify_token'];
        const challenge = request.query['hub.challenge'];

        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            fastify.log.info('Messenger webhook verified');
            return reply.code(200).send(challenge);
        }

        fastify.log.warn({ mode, token }, 'Messenger webhook verification failed');
        return reply.code(403).send();
    });

    // Incoming messages
    fastify.post(
        '/webhook/messenger',
        { config: { rateLimit: { max: 100, timeWindow: 1000 } } },
        async (request, reply) => {
            const entries = request.body?.entry ?? [];

            for (const entry of entries) {
                const pageId = entry.id;
                for (const event of entry.messaging ?? []) {
                    if (!isValidMessengerEvent(event)) {
                        fastify.log.warn({ event }, 'Invalid Messenger event');
                        continue;
                    }
                    // Fire-and-forget per Facebook webhook contract
                    handleEvent(event, pageId).catch(err =>
                        fastify.log.error({ err }, 'Messenger event handler error')
                    );
                }
            }

            return reply.code(200).send();
        }
    );
}

async function handleEvent(event, pageId) {
    const senderId = event.sender.id;

    // Quick reply payloads
    if (event.message?.quick_reply?.payload) {
        const response = handleQuickReplyPayload(event.message.quick_reply.payload);
        if (response) return sendMessage(senderId, response);
    }

    const text = sanitizeInput(event.message?.text);
    if (!text) return;

    const standard = getStandardReply(text, 'messenger');
    if (standard) return sendMessage(senderId, standard);

    const keyword = keywordReply(text, pageId);
    if (keyword) return sendMessage(senderId, keyword);

    return sendMessage(senderId, "🤖 I'm still learning. Try saying \"help\" to get started.");
}

async function sendMessage(recipientId, payload) {
    const message = typeof payload === 'string' ? { text: payload } : payload;
    await fetchJSON(`https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: recipientId }, message }),
    });
}
