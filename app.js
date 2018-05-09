var express = require('express')
var path = require('path')
var logger = require('morgan')

// const config = require('./config')

var app = express()

var FBBotFramework = require('fb-bot-framework');

// Initialize
var bot = new FBBotFramework({
    page_token: "EAAB68SY6pmkBAG0JqOdmAOKqxpQ1BjSN4H3llVafwAxOFD8ISZAUMAXB6pWZCSsJyFPC5l2CezFL7bnnHELwRiZCmRWSHlPNghJ0HBjXVEyWkt49C8i2em3PiginHpDwnuugiFcEM9I2ZBpXpclUOElmLDHhvjdWZBpL8tZB3cJwZDZD",
	verify_token: "dianafreyabryanbjorn",
});

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))
app.use(logger('dev'))

app.use('/webhook', bot.middleware())

// Setup listener for incoming messages
bot.on('message', function(userId, message){
    // bot.sendTextMessage(userId, "Echo Message:" + message);

    // Send quick replies
    var replies = [
        {
            "content_type": "text",
            "title": "Good",
            "payload": "thumbs_up"
        },
        {
            "content_type": "text",
            "title": "Bad",
            "payload": "thumbs_down"
        }
    ];
    bot.sendQuickReplies(userId, message, replies);
});

// Setup listener for quick reply messages
bot.on('quickreply', function(userId, payload){
    bot.sendTextMessage(userId, "payload:" + payload);
});

// Config the Get Started Button and register a callback
bot.setGetStartedButton("GET_STARTED");
bot.on('postback', function(userId, payload){

    if (payload == "GET_STARTED") {
        getStarted(userId);
    }

    // Other postback callbacks here
    // ...

});

function getStarted(userId){

    // Get started process
}

// Setup listener for attachment
bot.on('attachment', function(userId, attachment){

    // Echo the audio attachment
    if (attachment[0].type == "audio") {
        bot.sendAudioAttachment(userId, attachment[0].payload.url);
    }

});

// Make Express listening
app.listen(3000);