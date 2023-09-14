// Meant to keep some extra's like functions to connect to our database
const mysql = require('mysql2/promise');

let pool;
let notificationCache;
let apiCache;

const mysqlPool = async (host = '', user = '', pass = '', dbname = '') => {
    pool = mysql.createPool({
        host: host,
        user: user,
        password: pass,
        database: dbname,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        socketPath: '/run/mysqld/mysqld.sock',
    });
};

const mysqlQuery = async (sql = '', parameters = []) => {
    const [results,] = await pool.execute(sql, parameters);
    return results;
};

const emptyOrRows = (resultSet) => {
    if (!resultSet) {
        return [];
    }
    return resultSet;
};

const currentDateTime = () => {
    var newDate = new Date().toUTCString();
    //return newDate.getUTCFullYear() + '/' + (newDate.getUTCMonth() + 1) + '/' + newDate.getUTCDate() + ' ' + newDate.getUTCHours() + ':' + newDate.getUTCMinutes() + ':' + newDate.getUTCSeconds();
    return newDate;
};

const createNotificationCache = async () => {
    notificationCache = new Map();
    let activeGames = emptyOrRows(await mysqlQuery('select `game`, `last_reported_turn`, `turn_player` from `Games` where `active` = 1 and `game_name` = \'Civ6\''));
    console.log(activeGames);
    for (let game of activeGames) {
        notificationCache.set(game.game, { lastTurn: game.last_reported_turn, lastPlayer: game.turn_player });
    };
    console.log(`${currentDateTime()} : Created the notificationCache with all last known turns. There are ${notificationCache.size} known games!`);
};

const checkNotificationCache = (game = '') => {
    let lastNotification;
    if (notificationCache.has(game)) {
        console.log(`${currentDateTime()} : game ${game} found, returning`);
        lastNotification = notificationCache.get(game);
    } else {
        // First time we're seeing this game apperently.
        lastNotification = {
            'lastTurn': 0,
            'lastPlayer': 'Never played',
        };
    };
    return lastNotification;
};

const setNotificationCache = (game = '', newTurn = '', newPlayer = '') => {
    notificationCache.set(game, { lastTurn: newTurn, lastPlayer: newPlayer });
};

const createApiCache = async () => {
    apiCache = new Map();
    let activeApis = emptyOrRows(await mysqlQuery('select `id`, `api_key` from `Players` where `api_key` is not null'));
    for (let apiKey of activeApis) {
        apiCache.set(apiKey.api_key, true);
    };
    console.log(`${currentDateTime()} : Created the apiCache with all known API keys. There are ${apiCache.size} active API keys!`);
};

const checkActiveApiKey = (apiKey = '') => {
    let validApiKey;
    if (apiCache.has(apiKey)) {
        console.log(`${currentDateTime()} : api key ${apiKey} found, returning`);
        validApiKey = apiCache.get(apiKey);
    }
    return validApiKey;
};

module.exports = {
    mysqlPool,
    mysqlQuery,
    emptyOrRows,
    currentDateTime,
    createNotificationCache,
    checkNotificationCache,
    setNotificationCache,
    createApiCache,
    checkActiveApiKey,
};
