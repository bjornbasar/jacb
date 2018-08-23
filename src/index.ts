const telegraf = require('telegraf');

const bot = new telegraf('305843836:AAFHplqwLuNUNZyOS6KdoiMFq27QcqzyZT0');

bot.telegram.deleteWebhook();

bot.start((ctx: any) => ctx.reply('Welcome!'));
bot.help((ctx: any) => ctx.reply('Send me a sticker'));
bot.on('sticker', (ctx: any) => ctx.reply('👍'));
bot.hears('hi', (ctx: any) => ctx.reply('Hey there'));
bot.hears(/buy/i, (ctx: any) => ctx.reply('Buy-buy'));

bot.startPolling();
