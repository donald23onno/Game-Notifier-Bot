// Main bot file that will also handle immediate responses.
console.log('This is the Game Notifier Bot. It\'s meant for giving out turn notifications for asynchronous turns in games.');
console.log('Good examples of this are Sid Meier\'s Civilization 6 and Soren Johnson\'s Old World.\n');
console.log('Bot is now loading... Please wait...\n');
//console.log('...');

// Application config stuff goes into the config.json.
const { prefix, keepAliveTime } = require('./config.json');
// The "standard" discord library for NodeJS
const Discord = require('discord.js');
const { mysqlQuery, emptyOrRows, currentDateTime } = require('./helper.js');

let bot;

const client = (discordToken) => {
    bot = new Discord.Client({
        intents: [
            Discord.Intents.FLAGS.GUILDS,
            Discord.Intents.FLAGS.GUILD_MESSAGES,
            Discord.Intents.FLAGS.GUILD_MESSAGE_TYPING,
            Discord.Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
            Discord.Intents.FLAGS.DIRECT_MESSAGES,
        ],
    });

    bot.login(discordToken);

    bot.once('ready', () => {
        bot.user.setActivity('for new turns!', { type: 'WATCHING' });
        console.log('Bot is now finished loading and... Ready!');
        console.log('-----------------------------------------------------------------------------------');
        setInterval(async () => {
            let results = emptyOrRows(await mysqlQuery('select `discord_channel_id` from `Games` where `active` = 1'));
            if (results.length > 0) {
                // Iterate over active games to see if the turn notification channel needs a keep alive message.
                // We only need to do that if the channel is a thread though.
                for (let activeGame of results) {
                	let turnThread = await bot.channels.fetch(activeGame.discord_channel_id); //Test thread on my own server
                    if (turnThread.isThread()) {
                        let messages = await turnThread.messages.fetch({ limit: 1 });
                        let lastMessage = messages.first();
                        if ((Date.now() - lastMessage.createdTimestamp) > (23 * 60 * 60 * 1000)) {
                        	messageSend = turnThread.send(`Not much happening here ;) I'll keep the channel alive! Perhaps someone can play a turn in the mean time?`);
                        };
                    };
                };
            };
        }, keepAliveTime);
    });

    return bot;
};

const discordReply = async (message) => {
    let messageSend;
    if (!message.content.startsWith(`${prefix}`) || message.author.bot) return;

    try {
        switch (message.content) {
            case `${prefix}ping`:
                //message.channel.send('Pong!');
                message.reply('Pong!');
                break;
            case `${prefix}beep`:
                message.author.send('Boop!');
                break;
            case `${prefix}keepalive`:
                //let turnThread = await bot.channels.fetch('871100324742594660'); //Thread or Channel
                let turnThread = await bot.channels.fetch('871112615680675940'); //Test thread on my own server
                console.log(`turnThread object: ${turnThread}`);
                messageSend = turnThread.send('Stayin Alive! -- https://music.youtube.com/watch?v=vOIeXBEKeLc&list=RDAMVMvOIeXBEKeLc ');
                break;
            case `${prefix}gameinfo`:
                let channel = await bot.channels.fetch('554035300444405780');
                let pinnedMessages = await channel.messages.fetchPinned();
                console.log(`Messages: ${pinnedMessages}`);
                messageSend = channel.send('The pinned messages were fetched!');
                break;
            default:
                console.log('ERR: not a recognized command!');
                message.reply('That is not a recognized command, feel free to try again :)');
        }
    } catch (error) {
        console.log(`ERR : An error occurred: ${error}`);
    };
};

const civ6Notification = async (turnNotification = {}, mentionedPlayer = [], mentionedGame = []) => {
    let returnStatus = 400;
    // This is called when it's determined that we get Civ6 notification from a game
    // Value1 = the name of the game.
    // Value2 = the name of the player.
    // Value3 = the current turn in the game.
    const { Value1, Value2, Value3 } = turnNotification;
    const turnPlayer = existingPlayer(mentionedPlayer, Value2);
    const turnGame = existingGame(turnPlayer, mentionedGame, Value3, Value1);
    // Actual notification that I'd rather have in the config.json, but for now put here, due to not having a templating library yet.
    const civ6TurnNotification = `***# NEW TURN #***\nThere is a new turn on a Civilization VI PBC game!\nGo here to launch the game: steam://run/289070/\n\n***# Game information: #***\n**Game:** ${turnGame.gameName}\n**Current player:** ${turnPlayer.mention}\n**Current turn in game:** ${turnGame.currentTurn}\n*Timestamp (UTC):* ${currentDateTime()}\n`;
    console.log(civ6TurnNotification);
    if (turnGame.hasOwnProperty('channelToNotify')) {
        let results = emptyOrRows(await mysqlQuery('select `last_reported_turn`, `turn_player` from `Games` where `id` = ?', [turnGame.id]));
        if (results.length > 0 && results[0].last_reported_turn == turnGame.currentTurn && results[0].turn_player == turnGame.currentPlayer) {
            console.log(`Turn number ${turnGame.currentTurn} for player ${Value2} was already reported! Not reporting again.`);
            returnStatus = 200;
        } else {
            if (results.length > 0) {
                try {
                    let results = await mysqlQuery('update `Games` set `last_reported_turn` = ?, `turn_player` = ?, `last_change` = current_timestamp() where `id` = ?', [turnGame.currentTurn, turnGame.currentPlayer, turnGame.id]);
                } catch (error) {
                    console.log(`ERR : An error occured on updating database: ${error}`);
                };
            };
            sendMessageToChannel(civ6TurnNotification, turnGame.channelToNotify);
            returnStatus = 200;
        }
    };
    return returnStatus;
};

const owNotification = async (turnNotification = {}, mentionedPlayer = [], mentionedGame = []) => {
    let returnStatus = 400;
    // This is called when it's determined that we get OW notification from a game
    // game = the name of the game.
    // player = the name of the player.
    // turn = the current turn in the game.
    const { game, turn, player } = turnNotification;
	const turnPlayer = existingPlayer(mentionedPlayer, player);
    const turnGame = existingGame(turnPlayer, mentionedGame, turn, game);
    // Actual notification that I'd rather have in the config.json, but for now put here, due to not having a templating library yet.
    const owTurnNotification = `***# NEW TURN #***\nThere is a new turn on an Old World PBC game!\nGo here to launch the game: com.epicgames.launcher://apps/Nightjar?action=launch&silent=true\n\n***# Game information: #***\n**Game:** ${turnGame.gameName}\n**Current player:** ${turnPlayer.mention}\n**Current turn in game:** ${turnGame.currentTurn}\n*Timestamp (UTC):* ${currentDateTime()}\n`;
    console.log(owTurnNotification);
    if (turnGame.hasOwnProperty('channelToNotify')) {
        let results = emptyOrRows(await mysqlQuery('select `last_reported_turn`, `turn_player` from `Games` where `id` = ?', [turnGame.id]));
        if (results.length > 0 && results[0].last_reported_turn == turnGame.currentTurn && results[0].turn_player == turnGame.currentPlayer) {
            console.log(`Turn number ${turnGame.currentTurn} for player ${Value2} was already reported! Not reporting again.`);
            returnStatus = 200;
        } else {
            if (results.length > 0) {
                try {
                    let results = await mysqlQuery('update `Games` set `last_reported_turn` = ?, `turn_player` = ?, `last_change` = current_timestamp() where `id` = ?', [turnGame.currentTurn, turnGame.currentPlayer, turnGame.id]);
                } catch (error) {
                    console.log(`ERR : An error occured on updating database: ${error}`);
                };
            };
            sendMessageToChannel(owTurnNotification, turnGame.channelToNotify);
            returnStatus = 200;
        }
    };
    return returnStatus;
};

const sendMessageToChannel = async (messageToSend, channelId) => {
    // This will send a message to a Discord channel (or thread).
	try {
    	let channel = await bot.channels.fetch(channelId);
	    channel.send(messageToSend);
    } catch (error) {
    	if (error.message.includes('Unknown Channel')) {
            try {
                let user = await bot.users.fetch(channelId);
                user.send(messageToSend);
            } catch (error) {
                console.log(`ERR : First we encountered an 'Unknown Channel' and then another error occurred: ${error}`);
            };
        } else {
            console.log(`ERR : An error occurred: ${error}`);
        };
	};
};

const existingPlayer = (playerArray = [], turnObjectPlayer = '') => {
    if (playerArray.length > 0) {
        return playerObject = {
            'id': playerArray[0].id,
            'mention': `<@!${playerArray[0].discord_player_id}>`,
            'discordId': playerArray[0].discord_player_id,
        };
    } else {
        return playerObject = {
            'id': null,
            'mention': turnObjectPlayer,
            'discordId': null,
        };
    };
};

const existingGame = (playerObject = {}, gameArray = [], turnObjectTurn = '', turnObjectGame = '') => {
    if (gameArray.length > 0) {
        // some code to deal with a know game
        return gameObject = {
            'id': gameArray[0].id,
            'currentTurn': turnObjectTurn,
            'currentPlayer': playerObject.id,
            'gameName': gameArray[0].game,
            'channelToNotify': gameArray[0].discord_channel_id,
        };
    } else {
        console.log(`An unknown Civ6 game was reported! -- The game name was: ${turnObjectGame}`);
        if (playerObject.id == null) {
            // Game and player are unknown to the bot!
            console.log('We also don\'t know the reported player. Not sending a notification!');
            return gameObject = {};
        } else {
            // The game is unknown, but we know the player, so we send a DM with the notification.
            return gameObject = {
                'id': null,
                'currentTurn': turnObjectTurn,
                'currentPlayer': playerObject.id,
                'gameName': turnObjectGame,
                'channelToNotify': playerObject.discordId,
            };
        };
    };
};


//bot.on('interactionCreate', async (interaction) => {
//    console.log(`Triggering interaction: ${interaction}`);
//});



module.exports = {
    client,
    discordReply,
    civ6Notification,
    owNotification,
};