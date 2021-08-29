// Meant to keep some extra's like functions to connect to our database
const mysql = require('mysql2/promise');

let pool;

const mysqlPool = async (host, user, pass, dbname) => {
    pool = mysql.createPool({
        host: host,
        user: user,
        password: pass,
        database: dbname,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
};

const mysqlQuery = async (sql, parameters = []) => {
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
    var newDate = new Date();
    return newDate.getUTCFullYear() + '/' + (newDate.getUTCMonth() + 1) + '/' + newDate.getUTCDate() + ' ' + newDate.getUTCHours() + ':' + newDate.getUTCMinutes() + ':' + newDate.getUTCSeconds();
};

module.exports = {
    mysqlPool,
    mysqlQuery,
    emptyOrRows,
    currentDateTime,
};
