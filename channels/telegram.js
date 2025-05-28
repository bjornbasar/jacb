// channels/telegram.js
const axios = require('axios');
const handleMessage = require('../core/intentProcessor');

const TG_TOKEN = process.env.TG_TOKEN;

exports.handle = async (req, res) => {
    const update = req.body;

    if (!update.message || !update.message.text) {
        return res.sendStatus(200);
    }

    const chatId = update.message.chat.id;
    const text = update.message.text;

    const senderId = req.body.message.from.id;
    const reply = await handleMessage(senderId, text, 'telegram');


    await axios.post(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: reply,
    });

    res.sendStatus(200);
};
