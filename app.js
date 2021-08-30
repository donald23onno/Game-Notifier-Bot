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
const { mysqlPool, mysqlQuery, emptyOrRows } = require('./helper.js');
// I run this once in the nodeJS server.
mysqlPool(process.env.DB_HOST, process.env.DB_USER, process.env.DB_PASS, process.env.DB_NAME);

const port = process.env.PORT;

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
    const reportedGame = request.params['1'];
    const reportingUser = request.params['2'];
    let turnNotificationObject = Object.assign({ reportingUser: reportingUser, reportedGame: reportedGame }, request.body);
    console.log(`--= New ${reportedGame} turn notification received! =--`);
    console.log(turnNotificationObject);
    console.log('--= End of received turn notification =--');

    const registeredPlayer = await mysqlQuery('select * from `Players` where `api_key` = ?', [reportingUser]);
    if (!registeredPlayer) {
        console.log(`The used API key (${reportingUser}) is not registered to any player. Dropping notification!`);
        result.sendStatus(401);
        return;
    }
    
    // Actually doing something with the received notification :)
    // This will obviously depend on what game was reported, which we get from the used end-point.
    let mentionedPlayer;
    let mentionedGame;
    let returnStatus;
    switch (turnNotificationObject.reportedGame.toLowerCase()) {
        case 'civ6':
            returnStatus = 500;
            try {
                if (!turnNotificationObject.hasOwnProperty('value1') && !turnNotificationObject.hasOwnProperty('value2') && !turnNotificationObject.hasOwnProperty('value3')) {
                    returnStatus = 400;
                    throw ('Critical properties are missing from the incoming turn notification! Aborting');
                };
                let queryPlayer = turnNotificationObject.value2.replace('_', '\_');
                mentionedPlayer = emptyOrRows(await mysqlQuery('select * from `Players` where `game_player_name` like ?', ['%' + queryPlayer + '%']));
                mentionedGame = emptyOrRows(await mysqlQuery('select * from `Games` where `game` = ?', [turnNotificationObject.value1]));
                returnStatus = await civ6Notification(turnNotificationObject, mentionedPlayer, mentionedGame);
            } catch (error) {
                console.log(`ERR : Error occurred while getting game or player from database: ${error}`);
            };
            console.log('Turn notification for Civ6 is processed.');
            console.log('--= END OF TURN PROCESSING =--\n\n');
            result.sendStatus(returnStatus);
            break;
        case 'ow':
            returnStatus = 500;
            const playerExtractRegex = /\(([^)]+)\)/;
            turnNotificationObject.player = playerExtractRegex.exec(turnNotificationObject.player)[1];
            try {
                if (!turnNotificationObject.hasOwnProperty('game') && !turnNotificationObject.hasOwnProperty('turn') && !turnNotificationObject.hasOwnProperty('player')) {
                    returnStatus = 400;
                    throw ('Critical properties are missing from the incoming turn notification! Aborting');
                };
                let queryPlayer = turnNotificationObject.player.replace('_', '\_');
                mentionedPlayer = emptyOrRows(await mysqlQuery('select * from `Players` where `game_player_name` like ?', ['%' + queryPlayer + '%']));
                mentionedGame = emptyOrRows(await mysqlQuery('select * from `Games` where `game` = ?', [turnNotificationObject.game]));
                returnStatus = await owNotification(turnNotificationObject, mentionedPlayer, mentionedGame);
            } catch (error) {
                console.log(`ERR : Error occurred while getting game or player from database: ${error}`);
            };
            console.log('Turn notification for OW is processed.');
            console.log('--= END OF TURN PROCESSING =--\n\n');
            result.sendStatus(returnStatus);
            break;
        default:
            console.log('Turn notification is not for a supported game, dropping...');
            result.sendStatus(400);
    }
});

webListener.listen(port, () => {
    console.log(`GameNotifierBot is now listening at port: ${port}\n`);
});
