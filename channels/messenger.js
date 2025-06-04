const axios = require('axios');
const { keywordReply, handleQuickReplyPayload } = require('../core/messengerResponses');
const getStandardReply = require('../core/standardReplies');

const PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;
const FB_ADMIN_ID = process.env.FB_ADMIN_ID;
const PAGE_ID = process.env.FB_PAGE_ID;

exports.verify = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }

    res.sendStatus(403);
};

exports.handle = async (req, res) => {
    const entries = req.body.entry || [];

    for (const entry of entries) {
        const pageId = entry.id; // 🔹 Here’s the page the event came from
        const events = entry.messaging || [];

        for (const event of events) {
            const senderId = event.sender.id;

            // Handle quick replies
            if (event.message?.quick_reply?.payload) {
                const payloadResponse = handleQuickReplyPayload(event.message.quick_reply.payload);
                if (payloadResponse) {
                    await sendMessage(senderId, payloadResponse);
                    continue;
                }
            }

            // Handle text commands
            const text = event.message?.text;
            
            if (!text) continue;
            const standard = getStandardReply(text, 'messenger');
            if (standard) {
                await sendMessage(senderId, standard);
                continue;
            }

            if (text.toLowerCase().startsWith('post:')) {
                if (senderId !== FB_ADMIN_ID) {
                    await sendMessage(senderId, '🚫 You are not authorized to post.');
                } else {
                    const messageToPost = text.slice(5).trim();
                    try {
                        await axios.post(`https://graph.facebook.com/v17.0/${PAGE_ID}/feed`, {
                            message: messageToPost,
                            access_token: PAGE_TOKEN,
                        });
                        await sendMessage(senderId, '✅ Posted to Page wall.');
                    } catch (err) {
                        console.error('Failed to post to wall:', err.response?.data || err.message);
                        await sendMessage(senderId, '❌ Failed to post to the Page.');
                    }
                }
                continue;
            }

            // Handle keyword response
            const reply = keywordReply(text, pageId);
            if (reply) {
                await sendMessage(senderId, reply);
            } else {
                await sendMessage(senderId, `🤖 I'm still learning. Try saying "help" to get started.`);
            }
        }
    }

    res.sendStatus(200);
};

async function sendMessage(recipientId, payload) {
    const messageData =
        typeof payload === 'string'
            ? { text: payload }
            : payload;

    await axios.post(`https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_TOKEN}`, {
        recipient: { id: recipientId },
        message: messageData,
    });
}
