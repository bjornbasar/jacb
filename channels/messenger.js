// channels/messenger.js
const axios = require('axios');
const handleMessage = require('../core/intentProcessor');

const PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;

exports.verify = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    console.log('mode:', mode, 'token:', token, 'expected:', process.env.FB_VERIFY_TOKEN);

    if (mode === 'subscribe' && token === process.env.FB_VERIFY_TOKEN) {
        console.log('Webhook verified');
        return res.status(200).send(challenge);
    } else {
        console.warn('Verification failed:', token);
        return res.sendStatus(403);
    }
};

exports.handle = async (req, res) => {
    const entries = req.body.entry || [];

    for (const entry of entries) {
        const events = entry.messaging || [];

        for (const event of events) {
            const senderId = event.sender.id;

            if (event.message?.text) {
                const reply = await handleMessage(senderId, event.message.text);
                await sendMessage(senderId, reply);
            } else if (event.postback?.payload) {
                // Respond to postbacks too
                await sendMessage(senderId, `Postback received: ${event.postback.payload}`);
            } else {
                console.log('Unhandled Messenger event:', JSON.stringify(event, null, 2));
            }
        }
    }

    res.sendStatus(200);
};

async function sendMessage(recipientId, text) {
    await axios.post(
        `https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_TOKEN}`,
        {
            recipient: { id: recipientId },
            message: { text },
        }
    );
}
