import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
    ActivityType,
    ChannelType,
    Client,
    Events,
    GatewayIntentBits,
    Partials,
    type ChatInputCommandInteraction,
    type Interaction,
    type Message,
} from 'discord.js';
import { currentDateTime, emptyOrRows, mysqlQuery } from './helper';

interface AppConfig {
    prefix: string;
    keepAliveCheck: number;
    keepAliveTime: number;
    keepAliveMessages: string[];
}

interface PlayerRow {
    id: number;
    discord_player_id: string;
}

interface GameRow {
    id: number;
    game: string;
    discord_channel_id: string;
    last_reported_turn: number | null;
    turn_player: number | null;
}

interface ActiveGameRow extends GameRow {
    last_timestamp: number | null;
}

interface PlayerReference {
    id: number | null;
    mention: string;
    discordId: string | null;
}

interface GameReference {
    id: number | null;
    currentTurn: number | string;
    currentPlayer: number | null;
    gameName: string;
    channelToNotify: string;
}

export interface Civ6TurnNotification {
    reportingUser: string;
    reportedGame: 'civ6';
    value1: string;
    value2: string;
    value3: number | string;
}

export interface OldWorldTurnNotification {
    reportingUser: string;
    reportedGame: 'ow';
    game: string;
    turn: number | string;
    player: string;
}

const loadAppConfig = (): AppConfig => {
    const configPath = path.resolve(process.cwd(), 'config.json');
    return JSON.parse(readFileSync(configPath, 'utf8')) as AppConfig;
};

const { prefix, keepAliveCheck, keepAliveTime, keepAliveMessages } = loadAppConfig();

console.log(`Current time is: ${ currentDateTime() }`);
console.log('This is the Game Notifier Bot. It\'s meant for giving out turn notifications for asynchronous turns in games.');
console.log('Good examples of this are Sid Meier\'s Civilization 6 and Soren Johnson\'s Old World.\n');
console.log('Bot is now loading... Please wait...\n');

let bot: Client<boolean>;

export const createClient = (discordToken: string): Client<boolean> => {
    bot = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.MessageContent,
        ],
        partials: [Partials.Channel],
    });

    bot.once(Events.ClientReady, (readyClient) => {
        readyClient.user.setActivity('for new turns!', { type: ActivityType.Watching });
        console.log('Bot is now finished loading and... Ready!');
        console.log(`Current time is: ${ currentDateTime() }`);
        console.log('-----------------------------------------------------------------------------------');

        setInterval(async () => {
            const results = emptyOrRows(
                await mysqlQuery<ActiveGameRow[]>(
                    'select `id`, `last_reported_turn`, `turn_player`, `game`, `discord_channel_id`, UNIX_TIMESTAMP(`last_change`) as last_timestamp from `Games` where `active` = 1'
                )
            );

            if (results.length === 0) {
                return;
            }

            for (const activeGame of results) {
                const turnThread = await bot.channels.fetch(activeGame.discord_channel_id);

                if (!turnThread?.isThread()) {
                    continue;
                }

                const messages = await turnThread.messages.fetch({ limit: 1 });
                const lastMessage = messages.first();

                if (!lastMessage) {
                    continue;
                }

                if ((Date.now() - lastMessage.createdTimestamp) <= keepAliveTime) {
                    continue;
                }

                const longTimeNoSee = (3 * keepAliveTime) / 1000;
                let messageToSend = '';

                if (activeGame.last_timestamp !== null && ((Date.now() / 1000) - activeGame.last_timestamp) > longTimeNoSee) {
                    console.log('INFO : We think it\'s been a while since we pinged someone, let\'s ping the current player!');

                    if (activeGame.turn_player === null) {
                        console.log('INFO : Unfortunately though, there is no current player known! So pinging no-one...');
                        messageToSend = keepAliveMessages[Math.floor(Math.random() * keepAliveMessages.length)];
                    } else {
                        try {
                            const playerToNotify = emptyOrRows(
                                await mysqlQuery<PlayerRow[]>('select * from `Players` where `id` = ?', [activeGame.turn_player])
                            );

                            if (playerToNotify.length > 0) {
                                messageToSend = `It\'s been a while since a turn was played. The current turn is with <@!${ playerToNotify[0].discord_player_id }>. Perhaps an extra ping helps :face_with_peeking_eye: `;
                                await mysqlQuery('update `Games` set `last_change` = current_timestamp() where `id` = ?', [activeGame.id]);
                            }
                        } catch (error) {
                            console.log(`ERR : While executing 'keepAlive checks', an error occured on updating database: ${ error }`);
                        }
                    }
                } else {
                    messageToSend = keepAliveMessages[Math.floor(Math.random() * keepAliveMessages.length)];
                }

                if (messageToSend) {
                    await sendMessageToChannel(messageToSend, activeGame.discord_channel_id);
                }
            }
        }, keepAliveCheck);
    });

    void bot.login(discordToken);
    return bot;
};

export const discordCommandHandler = async (interaction: Interaction): Promise<void> => {
    if (!interaction.isChatInputCommand()) {
        return;
    }

    switch (interaction.commandName) {
        case 'ping':
            await interaction.reply('Pong!');
            break;
        case 'info':
            await handleInfoCommand(interaction);
            break;
        default:
            console.log(`This shouldn't happen... used command was: ${ interaction.commandName }`);
    }
};

const handleInfoCommand = async (interaction: ChatInputCommandInteraction): Promise<void> => {
    const subCommand = interaction.options.getSubcommand();

    if (subCommand === 'server') {
        const guild = interaction.guild;
        const memberCount = guild?.memberCount ?? 'unknown';
        await interaction.reply(`Server info: ${ guild?.name ?? 'unknown server' } has ${ memberCount } members.`);
        return;
    }

    const targetUser = interaction.options.getUser('target') ?? interaction.user;
    await interaction.reply(`User information: ${ targetUser.username } (${ targetUser.id })`);
};

export const discordReply = async (message: Message): Promise<void> => {
    if (!message.content.startsWith(prefix) || message.author.bot) {
        return;
    }

    try {
        switch (message.content.trim()) {
            case `${ prefix }ping`:
                await message.reply('Pong!');
                break;
            case `${ prefix }beep`:
                await message.author.send('Boop!');
                break;
            case `${ prefix }keepalive`: {
                const turnThread = await bot.channels.fetch('871112615680675940');
                console.log(`turnThread object: ${ turnThread }`);
                if (turnThread?.isSendable()) {
                    await turnThread.send('Stayin Alive! -- https://music.youtube.com/watch?v=vOIeXBEKeLc&list=RDAMVMvOIeXBEKeLc ');
                }
                break;
            }
            case `${ prefix }gameinfo`: {
                const channel = await bot.channels.fetch('554035300444405780');
                if (channel?.type === ChannelType.GuildText) {
                    const pinnedMessages = await channel.messages.fetchPinned();
                    console.log(`Messages: ${ pinnedMessages }`);
                    await channel.send('The pinned messages were fetched!');
                }
                break;
            }
            default:
                console.log('ERR: not a recognized command!');
        }
    } catch (error) {
        console.log(`ERR : An error occurred: ${ error }`);
    }
};

export const civ6Notification = async (
    turnNotification: Civ6TurnNotification,
    mentionedPlayer: PlayerRow[] = [],
    mentionedGame: GameRow[] = []
): Promise<number> => {
    let returnStatus = 400;
    const { value1, value2, value3 } = turnNotification;
    const turnPlayer = existingPlayer(mentionedPlayer, value2);
    const turnGame = existingGame(turnPlayer, mentionedGame, value3, value1);

    if (!turnGame) {
        return returnStatus;
    }

    const civ6TurnNotification = `***# NEW TURN #***\nThere is a new turn on a Civilization VI PBC game!\nLaunch the game using your favorite launcher!!\n\n***# Game information: #***\n**Game:** ${ turnGame.gameName }\n**Current player:** ${ turnPlayer.mention }\n**Current turn in game:** ${ turnGame.currentTurn }\n*Timestamp (UTC):* ${ currentDateTime() }\n`;
    console.log(civ6TurnNotification);

    if (turnGame.id !== null) {
        const results = emptyOrRows(
            await mysqlQuery<Pick<GameRow, 'last_reported_turn' | 'turn_player'>[]>(
                'select `last_reported_turn`, `turn_player` from `Games` where `id` = ?',
                [turnGame.id]
            )
        );

        if (results.length > 0 && results[0].last_reported_turn == turnGame.currentTurn && results[0].turn_player == turnGame.currentPlayer) {
            console.log(`Turn number ${ turnGame.currentTurn } for player ${ value2 } was already reported! Not reporting again.`);
            return 200;
        }

        if (results.length > 0) {
            try {
                await mysqlQuery(
                    'update `Games` set `last_reported_turn` = ?, `turn_player` = ?, `last_change` = current_timestamp() where `id` = ?',
                    [turnGame.currentTurn, turnGame.currentPlayer, turnGame.id]
                );
            } catch (error) {
                console.log(`ERR : While executing 'civ6Notification', an error occured on updating database: ${ error }`);
            }
        }
    }

    await sendMessageToChannel(civ6TurnNotification, turnGame.channelToNotify);
    returnStatus = 200;
    return returnStatus;
};

export const owNotification = async (
    turnNotification: OldWorldTurnNotification,
    mentionedPlayer: PlayerRow[] = [],
    mentionedGame: GameRow[] = []
): Promise<number> => {
    let returnStatus = 400;
    const { game, player, turn } = turnNotification;
    const turnPlayer = existingPlayer(mentionedPlayer, player);
    const turnGame = existingGame(turnPlayer, mentionedGame, turn, game);

    if (!turnGame) {
        return returnStatus;
    }

    const owTurnNotification = `***# NEW TURN #***\nThere is a new turn on an Old World PBC game!\nLaunch the game using your favorite launcher!!\n\n***# Game information: #***\n**Game:** ${ turnGame.gameName }\n**Current player:** ${ turnPlayer.mention }\n**Current turn in game:** ${ turnGame.currentTurn }\n*Timestamp (UTC):* ${ currentDateTime() }\n`;
    console.log(owTurnNotification);

    if (turnGame.id !== null) {
        const results = emptyOrRows(
            await mysqlQuery<Pick<GameRow, 'last_reported_turn' | 'turn_player'>[]>(
                'select `last_reported_turn`, `turn_player` from `Games` where `id` = ?',
                [turnGame.id]
            )
        );

        if (results.length > 0 && results[0].last_reported_turn == turnGame.currentTurn && results[0].turn_player == turnGame.currentPlayer) {
            console.log(`Turn number ${ turnGame.currentTurn } for player ${ player } was already reported! Not reporting again.`);
            return 200;
        }

        if (results.length > 0) {
            try {
                await mysqlQuery(
                    'update `Games` set `last_reported_turn` = ?, `turn_player` = ?, `last_change` = current_timestamp() where `id` = ?',
                    [turnGame.currentTurn, turnGame.currentPlayer, turnGame.id]
                );
            } catch (error) {
                console.log(`ERR : While executing 'owNotification', an error occured on updating database: ${ error }`);
            }
        }
    }

    await sendMessageToChannel(owTurnNotification, turnGame.channelToNotify);
    returnStatus = 200;
    return returnStatus;
};

const sendMessageToChannel = async (messageToSend: string, channelId: string): Promise<void> => {
    try {
        const channel = await bot.channels.fetch(channelId);

        if (channel?.isSendable()) {
            await channel.send(messageToSend);
            return;
        }
    } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('Unknown Channel')) {
            console.log(`ERR : An error occurred: ${ error }`);
            return;
        }
    }

    try {
        const user = await bot.users.fetch(channelId);
        await user.send(messageToSend);
    } catch (error) {
        console.log(`ERR : First we encountered an 'Unknown Channel' and then another error occurred: ${ error }`);
    }
};

const existingPlayer = (playerArray: PlayerRow[] = [], turnObjectPlayer = ''): PlayerReference => {
    if (playerArray.length > 0) {
        return {
            id: playerArray[0].id,
            mention: `<@!${ playerArray[0].discord_player_id }>`,
            discordId: playerArray[0].discord_player_id,
        };
    }

    return {
        id: null,
        mention: turnObjectPlayer,
        discordId: null,
    };
};

const existingGame = (
    playerObject: PlayerReference,
    gameArray: GameRow[] = [],
    turnObjectTurn: number | string,
    turnObjectGame = ''
): GameReference | null => {
    if (gameArray.length > 0) {
        return {
            id: gameArray[0].id,
            currentTurn: turnObjectTurn,
            currentPlayer: playerObject.id,
            gameName: gameArray[0].game,
            channelToNotify: gameArray[0].discord_channel_id,
        };
    }

    console.log(`An unknown Civ6 game was reported! -- The game name was: ${ turnObjectGame }`);

    if (playerObject.id === null || playerObject.discordId === null) {
        console.log('We also don\'t know the reported player. Not sending a notification!');
        return null;
    }

    return {
        id: null,
        currentTurn: turnObjectTurn,
        currentPlayer: playerObject.id,
        gameName: turnObjectGame,
        channelToNotify: playerObject.discordId,
    };
};