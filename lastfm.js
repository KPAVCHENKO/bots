const sqlite3 = require('sqlite3').verbose();

// Создание базы данных и таблицы для Last.fm аккаунтов
function initializeDatabase() {
    const db = new sqlite3.Database('./lastfm_accounts.db');
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS accounts (
            username TEXT PRIMARY KEY,
            lastfmAccount TEXT
        )`);
    });
    db.close();
}

// Функция для загрузки аккаунтов Last.fm из базы данных
function loadLastFMAccounts() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database('./lastfm_accounts.db');
        db.all('SELECT * FROM accounts', [], (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            const accounts = {};
            rows.forEach(row => {
                accounts[row.username] = row.lastfmAccount;
            });
            resolve(accounts);
            db.close();
        });
    });
}

// Функция для сохранения аккаунтов Last.fm в базу данных
function saveLastFMAccounts(accounts) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database('./lastfm_accounts.db');
        db.serialize(() => {
            const stmt = db.prepare('REPLACE INTO accounts (username, lastfmAccount) VALUES (?, ?)');
            for (const [username, lastfmAccount] of Object.entries(accounts)) {
                stmt.run(username, lastfmAccount);
            }
            stmt.finalize();
        });
        db.close(err => {
            if (err) {
                reject(err);
                return;
            }
            resolve();
        });
    });
}

module.exports = {
    initializeDatabase,
    loadLastFMAccounts,
    saveLastFMAccounts
};
