import { createPool, type Pool, type RowDataPacket } from 'mysql2/promise';

interface NotificationCacheEntry {
  lastTurn: number | string | null;
  lastPlayer: number | string | null;
}

interface NotificationCacheRow extends RowDataPacket {
  game: string;
  last_reported_turn: number | null;
  turn_player: number | null;
}

interface ApiKeyRow extends RowDataPacket {
  api_key: string;
}

let pool: Pool | null = null;
let notificationCache = new Map<string, NotificationCacheEntry>();
let apiCache = new Map<string, boolean>();

export const mysqlPool = (host = '', user = '', pass = '', dbname = ''): void => {
  pool = createPool({
    host,
    user,
    password: pass,
    database: dbname,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    socketPath: '/run/mysqld/mysqld.sock',
  });
};

export const mysqlQuery = async <T = RowDataPacket[]> (
  sql = '',
  parameters: unknown[] = []
): Promise<T> => {
  if (!pool) {
    throw new Error('MySQL connection pool is not initialized.');
  }

  const [results] = await pool.execute(sql, parameters);
  return results as T;
};

export const emptyOrRows = <T> (resultSet: T[] | null | undefined): T[] => {
  if (!resultSet) {
    return [];
  }

  return resultSet;
};

export const currentDateTime = (): string => new Date().toUTCString();

export const createNotificationCache = async (): Promise<void> => {
  notificationCache = new Map<string, NotificationCacheEntry>();
  const activeGames = emptyOrRows(
    await mysqlQuery<NotificationCacheRow[]>('select `game`, `last_reported_turn`, `turn_player` from `Games` where `active` = 1')
  );

  console.log(activeGames);

  for (const game of activeGames) {
    notificationCache.set(game.game, {
      lastTurn: game.last_reported_turn,
      lastPlayer: game.turn_player,
    });
  }

  console.log(`${ currentDateTime() } : Created the notificationCache with all last known turns. There are ${ notificationCache.size } known games!`);
};

export const checkNotificationCache = (game = ''): NotificationCacheEntry => {
  if (notificationCache.has(game)) {
    console.log(`${ currentDateTime() } : game ${ game } found, returning`);
    return notificationCache.get(game) as NotificationCacheEntry;
  }

  return {
    lastTurn: 0,
    lastPlayer: 'Never played',
  };
};

export const setNotificationCache = (game = '', newTurn: number | string | null = '', newPlayer: number | string | null = ''): void => {
  notificationCache.set(game, { lastTurn: newTurn, lastPlayer: newPlayer });
};

export const createApiCache = async (): Promise<void> => {
  apiCache = new Map<string, boolean>();
  const activeApis = emptyOrRows(
    await mysqlQuery<ApiKeyRow[]>('select `api_key` from `Players` where `api_key` is not null')
  );

  for (const apiKey of activeApis) {
    apiCache.set(apiKey.api_key, true);
  }

  console.log(`${ currentDateTime() } : Created the apiCache with all known API keys. There are ${ apiCache.size } active API keys!`);
};

export const checkActiveApiKey = (apiKey = ''): boolean => {
  if (apiCache.has(apiKey)) {
    console.log(`${ currentDateTime() } : api key ${ apiKey } found, returning`);
    return apiCache.get(apiKey) as boolean;
  }

  return false;
};