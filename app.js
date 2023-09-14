// Sensitive data goes into the .env file that's not included in git.
const dotenv = require('dotenv');
dotenv.config();
// Application config stuff goes into the config.json.
const { } = require('./config.json');

// Importing a bunch of packages.
const express = require('express');
const bodyParser = require('body-parser');
// Get the Discord handling and helper we wrote
const { client, discordReply, civ6Notification, owNotification, discordCommandHandler } = require('./discord_handler.js');
const { mysqlPool, mysqlQuery, currentDateTime, emptyOrRows, createNotificationCache, checkNotificationCache, setNotificationCache, createApiCache, checkActiveApiKey } = require('./helper.js');
// I run this once in the nodeJS server.
mysqlPool(process.env.DB_HOST, process.env.DB_USER, process.env.DB_PASS, process.env.DB_NAME);
// Setting up a notificationCache using Map. This is faster and therefore more reliable to determine if a notification is already sent or not.
createNotificationCache();
// Same for known API keys.
createApiCache();

// Starting the bot
bot = client(process.env.TOKEN);
// And listening to some basic (test!) commands
bot.on('messageCreate', async (message) => {
    await discordReply(message);
});
// And listening to slash commands!
bot.on('interactionCreate', async (interaction) => {
    await discordCommandHandler(interaction);
});

// Setting up the ExpressJS part of the app, we need to listen to POST requests.
const webListener = express();
webListener.use(bodyParser.json());

webListener.get(/^(\/api|\/game)\/Civ6/, (request, result) => {
    result.send(`<h1>Game Notifier Bot</h1><p>This is the webinterface for the Game Notifier Bot on Discord.</p><p>You tried to use the Civilization VI endpoint, but this endpoint is needed in the game itself.<br>You can\'t do anything here :-)</p><hr><p>The endpoint you used: ${request.protocol + '://' + request.get('host') + request.url}</p>`);
});

webListener.get(/^(\/api|\/game)\/ow/, (request, result) => {
    result.send(`<h1>Game Notifier Bot</h1><p>This is the webinterface for the Game Notifier Bot on Discord.</p><p>You tried to use the Old World endpoint, but this endpoint is needed in the game itself.<br>You can\'t do anything here :-)</p><hr><p>The endpoint you used: ${request.protocol + '://' + request.get('host') + request.url}</p>`);
});

webListener.get('/*', (request, result) => {
    result.send(`<h1>Game Notifier Bot</h1><p>This is the webinterface for the Game Notifier Bot on Discord.</p><p>You can\'t do anything here :-)</p><hr><p>The endpoint you used: ${request.protocol + '://' + request.get('host') + request.url}</p>`);
});

webListener.post(/^(\/api|\/game)\/(Civ6|ow)\/([a-zA-Z0-9]+)/, async (request, result) => {
    // Let's give a reply to this turn notification.
    let reportedGame = request.params['1'].toLowerCase();
    let reportingUser = request.params['2'].toLowerCase();
    let turnNotificationObject = Object.assign({ reportingUser: reportingUser, reportedGame: reportedGame }, request.body);
    console.log(`${ currentDateTime() } : --= New ${ reportedGame } turn notification received! =--`);
    // Updating the notificationCache asap, to prevent double notifications. But only if a valid API key was used!
    let validApiKey = checkActiveApiKey(turnNotificationObject.reportingUser);
    if (!validApiKey) {
        console.log(`${currentDateTime()} : The used API key (${turnNotificationObject.reportingUser}) is not registered to any player. Dropping notification!`);
        result.sendStatus(401);
        return;
    };
    if (turnNotificationObject.reportedGame == 'civ6') {
        let lastNotification = checkNotificationCache(turnNotificationObject.value1);
        if (turnNotificationObject.value3 == lastNotification.lastTurn && turnNotificationObject.value2 == lastNotification.lastPlayer) {
            // Turn is already known, dropping this request
            console.log(`${currentDateTime()} : Turn number ${turnNotificationObject.value3} for player ${turnNotificationObject.value2} was already reported! Not reporting again.`);
            result.sendStatus(200);
            return;
        };
    };
    console.log(`${currentDateTime()} : `);
    console.log(turnNotificationObject);
    console.log(`${currentDateTime()} : --= End of received turn notification =--`);

    // Actually doing something with the received notification :)
    // This will obviously depend on what game was reported, which we get from the used end-point.
    let mentionedPlayer;
    let mentionedGame;
    let returnStatus;
    switch (turnNotificationObject.reportedGame) {
        case 'civ6':
            returnStatus = 500;
            try {
                if (!turnNotificationObject.hasOwnProperty('value1') && !turnNotificationObject.hasOwnProperty('value2') && !turnNotificationObject.hasOwnProperty('value3')) {
                    returnStatus = 400;
                    throw ('Critical properties are missing from the incoming turn notification! Aborting\n');
                };
                setNotificationCache(turnNotificationObject.value1, turnNotificationObject.value3, turnNotificationObject.value2);
                let queryPlayer = turnNotificationObject.value2.replace(/_/g, '\\_');
                // console.log(queryPlayer);
                mentionedPlayer = emptyOrRows(await mysqlQuery('select * from `Players` where `game_player_name` like ?', ['%' + queryPlayer + ',%']));
                mentionedGame = emptyOrRows(await mysqlQuery('select * from `Games` where `game` = ?', [turnNotificationObject.value1]));
                // if (mentionedPlayer.lenght < 1) {
                //     mentionedPlayer = queryPlayer;
                // }
                // if (mentionedGame.length < 1) {
                //     mentionedGame = turnNotificationObject.value1;
                // }
                returnStatus = await civ6Notification(turnNotificationObject, mentionedPlayer, mentionedGame);
            } catch (error) {
                console.log(`${currentDateTime()} : ERR : Error occurred while getting game or player from database: ${error}`);
            };
            console.log(`${currentDateTime()} : Turn notification for Civ6 is processed.`);
            console.log(`${currentDateTime()} : --= END OF TURN PROCESSING =--`);
            result.sendStatus(returnStatus);
            break;
        case 'ow':
            returnStatus = 500;
            try {
                const playerExtractRegex = /\(([^)]+)\)/;
                turnNotificationObject.player = playerExtractRegex.exec(turnNotificationObject.player)[1];
                if (!turnNotificationObject.hasOwnProperty('game') && !turnNotificationObject.hasOwnProperty('turn') && !turnNotificationObject.hasOwnProperty('player')) {
                    returnStatus = 400;
                    throw ('Critical properties are missing from the incoming turn notification! Aborting\n');
                };
                let queryPlayer = turnNotificationObject.player.replace('_', '\_');
                mentionedPlayer = emptyOrRows(await mysqlQuery('select * from `Players` where `game_player_name` like ?', ['%' + queryPlayer + '%']));
                mentionedGame = emptyOrRows(await mysqlQuery('select * from `Games` where `game` = ?', [turnNotificationObject.game]));
                // if (mentionedPlayer.lenght < 1) {
                //     mentionedPlayer = queryPlayer;
                // }
                // if (mentionedGame.length < 1) {
                //     mentionedGame = turnNotificationObject.value1;
                // }
                returnStatus = await owNotification(turnNotificationObject, mentionedPlayer, mentionedGame);
            } catch (error) {
                console.log(`${currentDateTime()} : ERR : Error occurred while getting game or player from database: ${error}`);
            };
            console.log(`${currentDateTime()} : Turn notification for OW is processed.`);
            console.log(`${currentDateTime()} : --= END OF TURN PROCESSING =--`);
            result.sendStatus(returnStatus);
            break;
        default:
            console.log(`${currentDateTime()} : Turn notification is not for a supported game, dropping...`);
            result.sendStatus(400);
    }
});

webListener.listen(process.env.PORT, () => {
    console.log(`${currentDateTime()} : GameNotifierBot is now listening at port: ${process.env.PORT}`);
});
