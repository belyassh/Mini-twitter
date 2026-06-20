import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import https from 'https'; // Встроенный модуль, работает стабильно и без сбоев ESM-импорта

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

let db;

// Твой рабочий токен PandaScore (с защитой от случайных пробелов)
// ТРЕБУЕТСЯ ЗАМЕНА, ЕСЛИ ОШИБКА 401 ПОВТОРИТСЯ НА НОВОМ ТОКЕНЕ!
const PANDASCORE_TOKEN = 'MnEg3fS3b8gXRqk-sP1bIL-HoWPGl_v8xvFZCAv2xoBUsrQ5OXY'.trim();

// Функция-помощник для безопасных HTTPS-запросов
function fetchFromPandaScore(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Ошибка парсинга JSON от PandaScore'));
                    }
                } else {
                    reject(new Error(`PandaScore вернул статус ${res.statusCode}: ${data}`));
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

async function initDB() {
    db = await open({
        filename: './database.db',
        driver: sqlite3.Database
    });

    // 1. Таблица пользователей
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 2. Таблица твитов
    await db.exec(`
        CREATE TABLE IF NOT EXISTS tweets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            image_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // 3. Таблица лайков
    await db.exec(`
        CREATE TABLE IF NOT EXISTS likes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tweet_id INTEGER NOT NULL,
            UNIQUE(user_id, tweet_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (tweet_id) REFERENCES tweets(id)
        )
    `);

    // 4. Таблица подписок
    await db.exec(`
        CREATE TABLE IF NOT EXISTS follows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            follower_id INTEGER NOT NULL,
            following_id INTEGER NOT NULL,
            UNIQUE(follower_id, following_id),
            FOREIGN KEY (follower_id) REFERENCES users(id),
            FOREIGN KEY (following_id) REFERENCES users(id)
        )
    `);

    // 5. Таблица уведомлений
    await db.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            tweet_id INTEGER NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (tweet_id) REFERENCES tweets(id)
        )
    `);

    // 6. Таблица матчей из PandaScore (Кэш)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS external_matches (
            id INTEGER PRIMARY KEY,
            videogame TEXT NOT NULL,
            team_a_name TEXT NOT NULL,
            team_b_name TEXT NOT NULL,
            team_a_logo TEXT,
            team_b_logo TEXT,
            begin_at TEXT,
            status TEXT DEFAULT 'not_started',
            winner_name TEXT DEFAULT NULL
        )
    `);

    // 7. Таблица прогнозов пользователей
    await db.exec(`
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            match_id INTEGER NOT NULL,
            predicted_winner TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, match_id),
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (match_id) REFERENCES external_matches(id)
        )
    `);

    console.log('База данных успешно подключена и настроена!');
    
    syncMatchesFromPandaScore().catch(err => console.error('Ошибка при первой синхронизации:', err));
}

/* ==================== ИНТЕГРАЦИЯ С PANDASCORE ==================== */

async function syncMatchesFromPandaScore() {
    console.log('Запуск синхронизации матчей с PandaScore...');
    
    const disciplines = [
        { endpoint: 'csgo', name: 'CS2' },
        { endpoint: 'dota2', name: 'DOTA2' },
        { endpoint: 'lol', name: 'LOL' }
    ];

    for (const game of disciplines) {
        try {
            const url = `https://api.pandascore.co/${game.endpoint}/matches?token=${PANDASCORE_TOKEN}&page[size]=40&sort=begin_at`;
            
            console.log(`Запрашиваем матчи для ${game.name}...`);
            const matches = await fetchFromPandaScore(url);
            
            if (!Array.isArray(matches)) continue;

            for (const match of matches) {
                // Строгая проверка на наличие двух оппонентов
                if (!match.opponents || match.opponents.length < 2) continue;

                const teamA = match.opponents[0]?.opponent;
                const teamB = match.opponents[1]?.opponent;

                // Если данные команд неполные — пропускаем шаг, чтобы не писать null/undefined структуры
                if (!teamA || !teamB || !teamA.name || !teamB.name) continue;

                const matchId = match.id;
                const status = match.status; 
                const winnerName = match.winner ? match.winner.name : null;
                const beginAt = match.begin_at ? new Date(match.begin_at).toISOString() : null;

                // ИСПРАВЛЕНО: Теперь при конфликте ID обновляются абсолютно все поля, включая логотипы и названия команд
                await db.run(`
                    INSERT INTO external_matches (id, videogame, team_a_name, team_b_name, team_a_logo, team_b_logo, begin_at, status, winner_name)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        status = excluded.status,
                        winner_name = excluded.winner_name,
                        begin_at = excluded.begin_at,
                        team_a_name = excluded.team_a_name,
                        team_b_name = excluded.team_b_name,
                        team_a_logo = excluded.team_a_logo,
                        team_b_logo = excluded.team_b_logo
                `, [matchId, game.name, teamA.name, teamB.name, teamA.image_url || null, teamB.image_url || null, beginAt, status, winnerName]);

                if (status === 'finished' && winnerName) {
                    await settlePredictions(matchId, winnerName);
                }
            }

        } catch (error) {
            console.error(`Ошибка при получении матчей для ${game.name}:`, error.message);
        }
    }
    console.log('Общая синхронизация с PandaScore завершена.');
}

async function settlePredictions(matchId, realWinner) {
    const pendingPredictions = await db.all(
        `SELECT id, predicted_winner FROM predictions WHERE match_id = ? AND status = 'pending'`,
        [matchId]
    );

    for (const pred of pendingPredictions) {
        const finalStatus = (pred.predicted_winner === realWinner) ? 'win' : 'loss';
        await db.run(`UPDATE predictions SET status = ? WHERE id = ?`, [finalStatus, pred.id]);
    }
}

setInterval(() => {
    syncMatchesFromPandaScore().catch(err => console.error(err));
}, 10 * 60 * 1000);


/* ==================== АУТЕНТИФИКАЦИЯ И ПРОФИЛЬ ==================== */

app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Пожалуйста, заполните все поля' });
    try {
        const result = await db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, password]);
        res.status(201).json({ message: 'Успешно!', userId: result.lastID });
    } catch (error) {
        if (error.message.includes('UNIQUE')) return res.status(400).json({ error: 'Никнейм или email заняты' });
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Заполните поля' });
    try {
        const user = await db.get('SELECT id, username FROM users WHERE email = ? AND password = ?', [email, password]);
        if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });
        res.json({ user: { id: user.id, username: user.username } });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/users/:id/profile', async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await db.get('SELECT id, username FROM users WHERE id = ?', [userId]);
        if (!user) return res.status(404).json({ error: 'Не найден' });
        
        const followersCount = await db.get('SELECT COUNT(*) as count FROM follows WHERE following_id = ?', [userId]);
        const followingCount = await db.get('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', [userId]);
        
        const winsCount = await db.get(`SELECT COUNT(*) as count FROM predictions WHERE user_id = ? AND status = 'win'`, [userId]);
        const lossesCount = await db.get(`SELECT COUNT(*) as count FROM predictions WHERE user_id = ? AND status = 'loss'`, [userId]);

        res.json({ 
            id: user.id, 
            username: user.username, 
            followers: followersCount.count, 
            following: followingCount.count,
            wins: winsCount.count,
            losses: lossesCount.count
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


/* ==================== ПРОГНОЗЫ И ЛИДЕРБОРД ==================== */

app.get('/api/predictions/matches', async (req, res) => {
    const { discipline } = req.query; 
    try {
        let matches;
        if (discipline && discipline !== 'ALL') {
            matches = await db.all('SELECT * FROM external_matches WHERE videogame = ? ORDER BY begin_at ASC', [discipline]);
        } else {
            matches = await db.all('SELECT * FROM external_matches ORDER BY begin_at ASC');
        }
        res.json(matches);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера при получении матчей' });
    }
});

app.post('/api/predictions', async (req, res) => {
    const { user_id, match_id, predicted_winner } = req.body;
    if (!user_id || !match_id || !predicted_winner) return res.status(400).json({ error: 'Не все данные заполнены' });

    try {
        const match = await db.get('SELECT status FROM external_matches WHERE id = ?', [match_id]);
        if (!match) return res.status(404).json({ error: 'Матч не найден' });
        if (match.status !== 'upcoming') return res.status(400).json({ error: 'Матч уже начался или завершился!' });

        await db.run(`
            INSERT INTO predictions (user_id, match_id, predicted_winner)
            VALUES (?, ?, ?)
        `, [user_id, match_id, predicted_winner]);

        res.status(201).json({ message: 'Прогноз зафиксирован!' });
    } catch (error) {
        if (error.message.includes('UNIQUE')) return res.status(400).json({ error: 'Вы уже сделали прогноз на этот матч' });
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/predictions/user/:userId', async (req, res) => {
    try {
        const userPredictions = await db.all(`
            SELECT p.*, m.team_a_name, m.team_b_name, m.videogame, m.status AS match_status, m.winner_name
            FROM predictions p
            JOIN external_matches m ON p.match_id = m.id
            WHERE p.user_id = ?
            ORDER BY p.created_at DESC
        `, [req.params.userId]);
        res.json(userPredictions);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        const leaderboard = await db.all(`
            SELECT 
                u.id, 
                u.username,
                COUNT(CASE WHEN p.status = 'win' THEN 1 END) as wins,
                COUNT(CASE WHEN p.status = 'loss' THEN 1 END) as losses,
                COUNT(p.id) as total_predictions
            FROM users u
            LEFT JOIN predictions p ON u.id = p.user_id
            GROUP BY u.id
            ORDER BY wins DESC, total_predictions ASC
            LIMIT 50
        `);
        res.json(leaderboard);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера при загрузке лидерборда' });
    }
});


/* ==================== ТВИТЫ, ЛЕНТА, ЛАЙКИ ==================== */

app.post('/api/tweets', async (req, res) => {
    const { user_id, content, image_url } = req.body;
    if (!user_id || !content) return res.status(400).json({ error: 'Заполните поля' });
    try {
        const tweetTime = new Date().toISOString();
        const result = await db.run('INSERT INTO tweets (user_id, content, image_url, created_at) VALUES (?, ?, ?, ?)', [user_id, content, image_url || null, tweetTime]);
        const tweetId = result.lastID;
        
        const mentions = content.match(/@([a-zA-Z0-9_]+)/g);
        if (mentions) {
            for (let mention of mentions) {
                const targetUsername = mention.substring(1);
                const targetUser = await db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [targetUsername]);
                if (targetUser && targetUser.id !== parseInt(user_id)) {
                    await db.run('INSERT INTO notifications (user_id, tweet_id) VALUES (?, ?)', [targetUser.id, tweetId]);
                }
            }
        }
        res.status(201).json({ message: 'Твит опубликован!' });
    } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.get('/api/tweets', async (req, res) => {
    try {
        const tweets = await db.all(`
            SELECT t.id, t.content, t.image_url, t.created_at, t.user_id, u.username,
            (SELECT COUNT(*) FROM likes l WHERE l.tweet_id = t.id) AS likes_count
            FROM tweets t JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC
        `);
        res.json(tweets);
    } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.get('/api/tweets/feed/:userId', async (req, res) => {
    try {
        const tweets = await db.all(`
            SELECT t.id, t.content, t.image_url, t.created_at, t.user_id, u.username,
            (SELECT COUNT(*) FROM likes l WHERE l.tweet_id = t.id) AS likes_count
            FROM tweets t JOIN users u ON t.user_id = u.id
            WHERE t.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?) ORDER BY t.created_at DESC
        `, [req.params.userId]);
        res.json(tweets);
    } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.get('/api/users/:id/tweets', async (req, res) => {
    try {
        const tweets = await db.all(`
            SELECT t.id, t.content, t.image_url, t.created_at, t.user_id, u.username,
            (SELECT COUNT(*) FROM likes l WHERE l.tweet_id = t.id) AS likes_count
            FROM tweets t JOIN users u ON t.user_id = u.id WHERE t.user_id = ? ORDER BY t.created_at DESC
        `, [req.params.id]);
        res.json(tweets);
    } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/follow', async (req, res) => {
    const { follower_id, following_id } = req.body;
    if (follower_id == following_id) return res.status(400).json({ error: 'Нельзя подписаться на себя' });
    try {
        const existingFollow = await db.get('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?', [follower_id, following_id]);
        if (existingFollow) {
            await db.run('DELETE FROM follows WHERE id = ?', [existingFollow.id]);
            res.json({ followed: false });
        } else {
            await db.run('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [follower_id, following_id]);
            res.json({ followed: true });
        }
    } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const notifications = await db.all(`
            SELECT n.id, t.content, t.created_at, u.username, t.user_id AS author_id
            FROM notifications n JOIN tweets t ON n.tweet_id = t.id JOIN users u ON t.user_id = u.id
            WHERE n.user_id = ? ORDER BY n.created_at DESC
        `, [req.params.userId]);
        res.json(notifications);
    } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

app.post('/api/likes', async (req, res) => {
    const { user_id, tweet_id } = req.body;
    try {
        const existingLike = await db.get('SELECT id FROM likes WHERE user_id = ? AND tweet_id = ?', [user_id, tweet_id]);
        if (existingLike) {
            await db.run('DELETE FROM likes WHERE id = ?', [existingLike.id]);
            res.json({ liked: false });
        } else {
            await db.run('INSERT INTO likes (user_id, tweet_id) VALUES (?, ?)', [user_id, tweet_id]);
            res.json({ liked: true });
        }
    } catch (error) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

initDB().then(() => {
    app.listen(PORT, () => console.log(`Сервер успешно запущен на: http://localhost:${PORT}`));
}).catch(err => console.error(err));