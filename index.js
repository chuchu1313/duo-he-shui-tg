const http = require('http');
const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');
const token = process.env.TOKEN;

let bot = new TelegramBot(token, { polling: true });
let job;

const LOCAL_CACHE = {};

bot.onText(/^\/([1-9][0-9]{0,2}|1000)$/, (msg) => {
    const drankWater = Number(msg.text.split('/')[1]);
    const chatId = msg.chat.id.toString();
    const userId = msg.from.id.toString();

    // init cache
    if (!LOCAL_CACHE[chatId]) {
        LOCAL_CACHE[chatId] = {};
    }
    if (!LOCAL_CACHE[chatId][userId]) {
        LOCAL_CACHE[chatId][userId] = { name: msg.from.first_name };
    }

    const formattedDate = getFormattedDate();
    let previousWater = LOCAL_CACHE[chatId][userId][formattedDate] || 0;
    const totalWater = previousWater + drankWater;
    LOCAL_CACHE[chatId][userId][formattedDate] = totalWater;

    bot.sendMessage(msg.chat.id, `${drankWater}/${totalWater}`);
});

bot.onText(/^\/help/, function (msg) {
    bot.sendMessage(msg.chat.id, "Welcome! Use the following commands:\n\n" +
        "/start - Start the job\n" +
        "/drink - Input the drink water amount\n" +
        "/status - Check already drank water amount")
});

bot.onText(/^\/drink/, function (msg) {
    bot.sendMessage(msg.chat.id, "Holaaaaa! Enter your water intake (number: 1~1000), eg: /100");
});

bot.onText(/^\/status/, function (msg) {
    const formattedDate = getFormattedDate();
    const chatId = msg.chat.id.toString();
    const userId = msg.from.id.toString();
    let drankWater = 0;
    if (LOCAL_CACHE[chatId] && LOCAL_CACHE[chatId][userId]) {
        drankWater = LOCAL_CACHE[chatId][userId][formattedDate] || 0;
    }
    bot.sendMessage(msg.chat.id, `🐱${msg.from.first_name}🐱 今日已喝水量 ${drankWater}`);
});

bot.onText(/^\/start/, function (msg) {
    bot.sendMessage(msg.chat.id, "Job start");
    if (!job) {
        job = schedule.scheduleJob('0 * * * *', () => {
            drinkCheck();
        });
    }
});

bot.onText(/\/stop/, () => {
    if (job) {
        job.cancel();
    }
});

const server = http.createServer((_, res) => {
    res.writeHead(200);
    res.end('OK');
});

server.listen(8888);

process.on('SIGTERM', () => server.close());

function getDate() {
    const localDate = new Date();
    const utcTimestamp = localDate.getTime() + (localDate.getTimezoneOffset() * 60000);
    return new Date(utcTimestamp + (8 * 60 * 60000));
}

function getFormattedDate() {
    const date = getDate();
    return date.toLocaleDateString('en-CA');
}

function drinkCheck() {
    process.stdout.write('Start Cronjob running');
    process.stdout.write(JSON.stringify(LOCAL_CACHE, null, 2) + '\n');

    const date = getDate();
    let hour = date.getHours();

    const formattedDate = getFormattedDate();
    const DRINK_MAP = {
        10: 200,
        11: 300,
        12: 400,
        13: 500,
        14: 700,
        15: 1000,
        16: 1200,
        17: 1400,
        18: 1600,
    };
    const dayTarget = DRINK_MAP[18];
    if (hour >= 10 && hour <= 19) {
        for (const chatId of Object.keys(LOCAL_CACHE)) {
            for (const userId of Object.keys(LOCAL_CACHE[chatId])) {
                const info = LOCAL_CACHE[chatId][userId];
                process.stdout.write(`Cronjob chatId: ${chatId}, userId: ${userId}, date: ${formattedDate}, current: ${LOCAL_CACHE[chatId][userId][formattedDate]}, target: ${DRINK_MAP[hour]} `);
                const previousWater = LOCAL_CACHE[chatId][userId][formattedDate] || 0;
                if (hour === 19) {
                    if (!info[formattedDate] || info[formattedDate] < dayTarget) {
                        bot.sendMessage(chatId, `🐱${info.name}🐱 今日喝水量 ${previousWater}，還差 ${dayTarget - previousWater} 達標，明日加油！💪`);
                    } else {
                        bot.sendMessage(chatId, `🐱${info.name}🐱 今日喝水量 ${previousWater}，已達標 🏆，太棒了！🎉`);
                    }
                } else if (!info[formattedDate] || info[formattedDate] < DRINK_MAP[hour]) {
                    bot.sendMessage(chatId, `🐱${info.name}🐱 喝水量只有 ${previousWater}，要喝到 ${DRINK_MAP[hour]}，快喝水🥤！`);
                }
            }
        }
    }
}
