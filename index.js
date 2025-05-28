// index.js
const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config();

const telegramHandler = require('./channels/telegram');
const messengerHandler = require('./channels/messenger');

const app = express();
app.use(bodyParser.json());

// Telegram Webhook
app.post('/webhook/telegram', telegramHandler.handle);

// Messenger Webhook
app.get('/webhook/messenger', messengerHandler.verify);
app.post('/webhook/messenger', messengerHandler.handle);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Bot server running on port ${PORT}`));
