import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

let db;

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

    // 2. Таблица твитов (Добавлено поле image_url)
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

    console.log('База данных успешно подключена и настроена!');
}

// Регистрация
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'Пожалуйста, заполните все поля' });
    }
    try {
        const result = await db.run(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, password]
        );
        res.status(201).json({ message: 'Успешно!', userId: result.lastID });
    } catch (error) {
        if (error.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Никнейм или email заняты' });
        }
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Авторизация
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

// Создание твита (с картинкой)
app.post('/api/tweets', async (req, res) => {
    const { user_id, content, image_url } = req.body;
    if (!user_id || !content) return res.status(400).json({ error: 'Заполните поля' });

    try {
        const tweetTime = new Date().toISOString();
        const result = await db.run(
            'INSERT INTO tweets (user_id, content, image_url, created_at) VALUES (?, ?, ?, ?)',
            [user_id, content, image_url || null, tweetTime]
        );
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
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение ВСЕХ твитов
app.get('/api/tweets', async (req, res) => {
    try {
        const tweets = await db.all(`
            SELECT 
                t.id, t.content, t.image_url, t.created_at, t.user_id, u.username,
                (SELECT COUNT(*) FROM likes l WHERE l.tweet_id = t.id) AS likes_count,
                (SELECT COUNT(*) FROM tweets tw WHERE tw.user_id = t.user_id) AS user_tweets_count,
                (SELECT COUNT(*) FROM notifications n WHERE n.user_id = t.user_id) AS user_notifications_count
            FROM tweets t
            JOIN users u ON t.user_id = u.id
            ORDER BY t.created_at DESC
        `);
        res.json(tweets);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Кастомная лента подписок (Твиты людей, на которых подписан юзер)
app.get('/api/tweets/feed/:userId', async (req, res) => {
    try {
        const tweets = await db.all(`
            SELECT 
                t.id, t.content, t.image_url, t.created_at, t.user_id, u.username,
                (SELECT COUNT(*) FROM likes l WHERE l.tweet_id = t.id) AS likes_count,
                (SELECT COUNT(*) FROM tweets tw WHERE tw.user_id = t.user_id) AS user_tweets_count,
                (SELECT COUNT(*) FROM notifications n WHERE n.user_id = t.user_id) AS user_notifications_count
            FROM tweets t
            JOIN users u ON t.user_id = u.id
            WHERE t.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)
            ORDER BY t.created_at DESC
        `, [req.params.userId]);
        res.json(tweets);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера при загрузке личной ленты' });
    }
});

// Твиты конкретного пользователя
app.get('/api/users/:id/tweets', async (req, res) => {
    try {
        const tweets = await db.all(`
            SELECT t.id, t.content, t.image_url, t.created_at, t.user_id, u.username,
            (SELECT COUNT(*) FROM likes l WHERE l.tweet_id = t.id) AS likes_count
            FROM tweets t
            JOIN users u ON t.user_id = u.id
            WHERE t.user_id = ?
            ORDER BY t.created_at DESC
        `, [req.params.id]);
        res.json(tweets);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Профиль пользователя с поддержкой статистики прогнозов
app.get('/api/users/:id/profile', async (req, res) => {
    try {
        const user = await db.get('SELECT id, username FROM users WHERE id = ?', [req.params.id]);
        if (!user) return res.status(404).json({ error: 'Не найден' });
        
        const followersCount = await db.get('SELECT COUNT(*) as count FROM follows WHERE following_id = ?', [req.params.id]);
        const followingCount = await db.get('SELECT COUNT(*) as count FROM follows WHERE follower_id = ?', [req.params.id]);
        
        // Заглушки под будущую таблицу прогнозов, чтобы фронтенд читал 0/0 по умолчанию
        const winsCount = 0; 
        const lossesCount = 0;

        res.json({ 
            id: user.id, 
            username: user.username, 
            followers: followersCount.count, 
            following: followingCount.count,
            wins: winsCount,
            losses: lossesCount
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Подписка / Отписка
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
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Уведомления
app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const notifications = await db.all(`
            SELECT n.id, t.content, t.created_at, u.username, t.user_id AS author_id
            FROM notifications n
            JOIN tweets t ON n.tweet_id = t.id
            JOIN users u ON t.user_id = u.id
            WHERE n.user_id = ?
            ORDER BY n.created_at DESC
        `, [req.params.userId]);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Лайки
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
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

initDB().then(() => {
    app.listen(PORT, () => console.log(`Сервер: http://localhost:${PORT}`));
}).catch(err => console.error(err));