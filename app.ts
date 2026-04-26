import dotenv from 'dotenv';
import express, { type Request, type Response } from 'express';
import { Events } from 'discord.js';
import {
    civ6Notification,
    createClient,
    discordCommandHandler,
    discordReply,
    owNotification,
    type Civ6TurnNotification,
    type OldWorldTurnNotification,
} from './discord_handler';
import {
    checkActiveApiKey,
    checkNotificationCache,
    createApiCache,
    createNotificationCache,
    currentDateTime,
    emptyOrRows,
    mysqlPool,
    mysqlQuery,
    setNotificationCache,
} from './helper';

interface PlayerRow {
    id: number;
    discord_player_id: string;
    game_player_name: string;
}

interface GameRow {
    id: number;
    game: string;
    discord_channel_id: string;
    last_reported_turn: number | null;
    turn_player: number | null;
}

type RouteParams = Record<string, string | undefined>;

dotenv.config();

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const isCiv6TurnNotification = (value: Record<string, unknown>): value is Omit<Civ6TurnNotification, 'reportingUser' | 'reportedGame'> => {
    return typeof value.value1 === 'string'
        && typeof value.value2 === 'string'
        && (typeof value.value3 === 'string' || typeof value.value3 === 'number');
};

const isOldWorldTurnNotification = (value: Record<string, unknown>): value is Omit<OldWorldTurnNotification, 'reportingUser' | 'reportedGame'> => {
    return typeof value.game === 'string'
        && typeof value.player === 'string'
        && (typeof value.turn === 'string' || typeof value.turn === 'number');
};

const createInformationalResponse = (request: Request, label: string): string => {
    return `<h1>Game Notifier Bot</h1><p>This is the webinterface for the Game Notifier Bot on Discord.</p><p>You tried to use the ${ label } endpoint, but this endpoint is needed in the game itself.<br>You can't do anything here :-)</p><hr><p>The endpoint you used: ${ request.protocol + '://' + request.get('host') + request.url }</p>`;
};

const bootstrap = async (): Promise<void> => {
    if (!process.env.TOKEN) {
        throw new Error('Missing TOKEN environment variable.');
    }

    if (!process.env.PORT) {
        throw new Error('Missing PORT environment variable.');
    }

    mysqlPool(process.env.DB_HOST, process.env.DB_USER, process.env.DB_PASS, process.env.DB_NAME);
    await createNotificationCache();
    await createApiCache();

    const bot = createClient(process.env.TOKEN);
    bot.on(Events.MessageCreate, async (message) => {
        await discordReply(message);
    });
    bot.on(Events.InteractionCreate, async (interaction) => {
        await discordCommandHandler(interaction);
    });

    const webListener = express();
    webListener.use(express.json());

    webListener.get(/^(\/api|\/game)\/Civ6/, (request: Request, result: Response) => {
        result.send(createInformationalResponse(request, 'Civilization VI'));
    });

    webListener.get(/^(\/api|\/game)\/ow/, (request: Request, result: Response) => {
        result.send(createInformationalResponse(request, 'Old World'));
    });

    webListener.get('/*', (request: Request, result: Response) => {
        result.send(`<h1>Game Notifier Bot</h1><p>This is the webinterface for the Game Notifier Bot on Discord.</p><p>You can't do anything here :-)</p><hr><p>The endpoint you used: ${ request.protocol + '://' + request.get('host') + request.url }</p>`);
    });

    webListener.post(/^(\/api|\/game)\/(Civ6|ow)\/([a-zA-Z0-9]+)/, async (request: Request, result: Response) => {
        const params = request.params as RouteParams;
        const reportedGame = params['1']?.toLowerCase() ?? '';
        const reportingUser = params['2']?.toLowerCase() ?? '';
        const requestBody = isObjectRecord(request.body) ? request.body : {};
        const turnNotificationObject = {
            reportingUser,
            reportedGame,
            ...requestBody,
        };

        console.log(`${ currentDateTime() } : --= New ${ reportedGame } turn notification received! =--`);

        const validApiKey = checkActiveApiKey(reportingUser);
        if (!validApiKey) {
            console.log(`${ currentDateTime() } : The used API key (${ reportingUser }) is not registered to any player. Dropping notification!`);
            result.sendStatus(401);
            return;
        }

        if (reportedGame === 'civ6' && isCiv6TurnNotification(turnNotificationObject)) {
            const lastNotification = checkNotificationCache(turnNotificationObject.value1);
            if (turnNotificationObject.value3 == lastNotification.lastTurn && turnNotificationObject.value2 == lastNotification.lastPlayer) {
                console.log(`${ currentDateTime() } : Turn number ${ turnNotificationObject.value3 } for player ${ turnNotificationObject.value2 } was already reported! Not reporting again.`);
                result.sendStatus(200);
                return;
            }
        }

        console.log(`${ currentDateTime() } : `);
        console.log(turnNotificationObject);
        console.log(`${ currentDateTime() } : --= End of received turn notification =--`);

        let mentionedPlayer: PlayerRow[] = [];
        let mentionedGame: GameRow[] = [];
        let returnStatus = 500;

        switch (reportedGame) {
            case 'civ6':
                try {
                    if (!isCiv6TurnNotification(turnNotificationObject)) {
                        console.log(`${ currentDateTime() } : ERR : Critical properties are missing from the incoming turn notification! Aborting`);
                        result.sendStatus(400);
                        return;
                    }

                    setNotificationCache(turnNotificationObject.value1, turnNotificationObject.value3, turnNotificationObject.value2);
                    const queryPlayer = turnNotificationObject.value2.replace(/_/g, '\\_');
                    mentionedPlayer = emptyOrRows(
                        await mysqlQuery<PlayerRow[]>('select * from `Players` where `game_player_name` like ?', [`%${ queryPlayer },%`])
                    );
                    mentionedGame = emptyOrRows(
                        await mysqlQuery<GameRow[]>('select * from `Games` where `active` = 1 and `game` = ?', [turnNotificationObject.value1])
                    );

                    const civ6Payload: Civ6TurnNotification = {
                        ...turnNotificationObject,
                        reportedGame: 'civ6',
                    };

                    if (mentionedGame.length === 0) {
                        console.log(`${ currentDateTime() } : Turn notification for non-existent or non-active game, no further action needed.`);
                        returnStatus = 200;
                    } else {
                        returnStatus = await civ6Notification(civ6Payload, mentionedPlayer, mentionedGame);
                    }
                } catch (error) {
                    console.log(`${ currentDateTime() } : ERR : Error occurred while getting game or player from database: ${ error }`);
                }

                console.log(`${ currentDateTime() } : Turn notification for Civ6 is processed.`);
                console.log(`${ currentDateTime() } : --= END OF TURN PROCESSING =--`);
                result.sendStatus(returnStatus);
                break;
            case 'ow':
                try {
                    if (!isOldWorldTurnNotification(turnNotificationObject)) {
                        console.log(`${ currentDateTime() } : ERR : Critical properties are missing from the incoming turn notification! Aborting`);
                        result.sendStatus(400);
                        return;
                    }

                    const queryPlayer = turnNotificationObject.player.replace(/_/g, '\\_');
                    mentionedPlayer = emptyOrRows(
                        await mysqlQuery<PlayerRow[]>('select * from `Players` where `game_player_name` like ?', [`%${ queryPlayer }%`])
                    );
                    mentionedGame = emptyOrRows(
                        await mysqlQuery<GameRow[]>('select * from `Games` where `active` = 1 and `game` = ?', [turnNotificationObject.game])
                    );

                    const oldWorldPayload: OldWorldTurnNotification = {
                        ...turnNotificationObject,
                        reportedGame: 'ow',
                    };

                    if (mentionedGame.length === 0) {
                        console.log(`${ currentDateTime() } : Turn notification for non-existent or non-active game, no further action needed.`);
                        returnStatus = 200;
                    } else {
                        returnStatus = await owNotification(oldWorldPayload, mentionedPlayer, mentionedGame);
                    }
                } catch (error) {
                    console.log(`${ currentDateTime() } : ERR : Error occurred while getting game or player from database: ${ error }`);
                }

                console.log(`${ currentDateTime() } : Turn notification for OW is processed.`);
                console.log(`${ currentDateTime() } : --= END OF TURN PROCESSING =--`);
                result.sendStatus(returnStatus);
                break;
            default:
                console.log(`${ currentDateTime() } : Turn notification is not for a supported game, dropping...`);
                result.sendStatus(400);
        }
    });

    webListener.listen(process.env.PORT, () => {
        console.log(`${ currentDateTime() } : GameNotifierBot is now listening at port: ${ process.env.PORT }`);
    });
};

void bootstrap().catch((error) => {
    console.error(`${ currentDateTime() } : Fatal startup error: ${ error }`);
    process.exit(1);
});