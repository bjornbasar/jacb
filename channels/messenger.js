const { keywordReply, handleQuickReplyPayload } = require('../core/messengerResponses');
const getStandardReply = require('../core/standardReplies');
const { sanitizeInput, isValidMessengerEvent, makeHttpRequest, HTTP_STATUS } = require('../core/utils');

const PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;
const FB_ADMIN_ID = process.env.FB_ADMIN_ID;
const PAGE_ID = process.env.FB_PAGE_ID;

if (!PAGE_TOKEN || !VERIFY_TOKEN) {
    throw new Error('FB_PAGE_TOKEN and FB_VERIFY_TOKEN environment variables are required');
}

exports.verify = (req, res) => {
    try {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('Webhook verified successfully');
            return res.status(HTTP_STATUS.OK).send(challenge);
        }

        console.warn('Webhook verification failed:', { mode, token });
        res.sendStatus(HTTP_STATUS.FORBIDDEN);
    } catch (error) {
        console.error('Webhook verification error:', error);
        res.sendStatus(HTTP_STATUS.INTERNAL_ERROR);
    }
};

exports.handle = async (req, res) => {
    try {
        const entries = req.body.entry || [];

        for (const entry of entries) {
            const pageId = entry.id;
            const events = entry.messaging || [];

            for (const event of events) {
                if (!isValidMessengerEvent(event)) {
                    console.warn('Invalid Messenger event received:', event);
                    continue;
                }

                await handleMessengerEvent(event, pageId);
            }
        }

        res.sendStatus(HTTP_STATUS.OK);
    } catch (error) {
        console.error('Messenger handler error:', {
            error: error.message,
            stack: error.stack,
            body: req.body
        });
        res.sendStatus(HTTP_STATUS.INTERNAL_ERROR);
    }
};

async function handleMessengerEvent(event, pageId) {
    const senderId = event.sender.id;

    try {
        // Handle quick replies
        if (event.message?.quick_reply?.payload) {
            const payloadResponse = handleQuickReplyPayload(event.message.quick_reply.payload);
            if (payloadResponse) {
                await sendMessage(senderId, payloadResponse);
                return;
            }
        }

        // Handle text commands
        const text = sanitizeInput(event.message?.text);
        if (!text) return;

        const standard = getStandardReply(text, 'messenger');
        if (standard) {
            await sendMessage(senderId, standard);
            return;
        }

        if (text.toLowerCase().startsWith('post:')) {
            await handlePostCommand(senderId, text);
            return;
        }

        // Handle keyword response
        const reply = keywordReply(text, pageId);
        if (reply) {
            await sendMessage(senderId, reply);
        } else {
            await sendMessage(senderId, `🤖 I'm still learning. Try saying "help" to get started.`);
        }
    } catch (error) {
        console.error('Error handling Messenger event:', error);
        await sendMessage(senderId, '❌ Something went wrong. Please try again later.');
    }
}

async function handlePostCommand(senderId, text) {
    if (senderId !== FB_ADMIN_ID) {
        await sendMessage(senderId, '🚫 You are not authorized to post.');
        return;
    }

    const messageToPost = text.slice(5).trim();
    if (!messageToPost) {
        await sendMessage(senderId, '❌ Post message cannot be empty.');
        return;
    }

    try {
        await makeHttpRequest(`https://graph.facebook.com/v17.0/${PAGE_ID}/feed`, {
            method: 'POST',
            data: {
                message: messageToPost,
                access_token: PAGE_TOKEN,
            }
        });
        await sendMessage(senderId, '✅ Posted to Page wall.');
    } catch (err) {
        console.error('Failed to post to wall:', err.response?.data || err.message);
        await sendMessage(senderId, '❌ Failed to post to the Page.');
    }
}

async function sendMessage(recipientId, payload) {
    const messageData =
        typeof payload === 'string'
            ? { text: payload }
            : payload;

    await makeHttpRequest(`https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_TOKEN}`, {
        method: 'POST',
        data: {
            recipient: { id: recipientId },
            message: messageData,
        }
    });
}
