# 🐦 Mini-twitter v1.0

Лёгкое приложение для обмена сообщениями в реальном времени с поддержкой 10 языков.

**A lightweight real-time messaging application with 10-language support.**

---

## 📋 Оглавление / Table of Contents

- [Особенности / Features](#-особенности--features)
- [Технологии / Technologies](#-технологии--technologies)
- [Установка / Installation](#-установка--installation)
- [Использование / Usage](#-использование--usage)
- [API Endpoints](#-api-endpoints)
- [Структура проекта / Project Structure](#-структура-проекта--project-structure)
- [Лицензия / License](#-лицензия--license)

---

## ✨ Особенности / Features

### Основные возможности / Core Features:
- ✅ **Аутентификация** / Authentication - Регистрация и вход с хешированием паролей
- ✅ **Твиты** / Tweets - Создание, просмотр и удаление сообщений
- ✅ **Лайки** / Likes - Ставьте лайки на посты других пользователей
- ✅ **Профиль** / Profile - Просмотр профиля с постами и статистикой
- ✅ **Подписки** / Following - Подписывайтесь на других пользователей
- ✅ **Уведомления** / Notifications - Система уведомлений о событиях
- ✅ **Лента** / Feed - Персональная и общая лента с постами

### 🌍 Многоязычность / Multilingual Support:
- 🇷🇺 Русский (Russian)
- 🇬🇧 English
- 🇩🇪 Deutsch
- 🇪🇸 Español
- 🇮🇹 Italiano
- 🇮🇱 עברית (Hebrew)
- 🇨🇳 中文 (Chinese)
- 🇯🇵 日本語 (Japanese)
- 🇺🇦 Українська (Ukrainian)
- 🇰🇷 한국어 (Korean)

### 🎨 Дополнительно / Extra:
- 🌓 Светлая и тёмная темы / Dark and Light themes
- 💾 Сохранение предпочтений / Preferences persistence
- 📱 Адаптивный дизайн / Responsive design
- ⚡ Работает без перезагрузки / Real-time updates

---

## 🛠 Технологии / Technologies

### Backend:
- **Node.js** 18+ с Express.js 5.2 (ES6 modules)
- **SQLite3** база данных
- **bcryptjs** для хеширования паролей

### Frontend:
- **Vanilla JavaScript** (без фреймворков)
- **HTML5** и **CSS3** с CSS переменными
- **localStorage** для хранения данных

### Tools:
- **npm** для управления зависимостями

---

## 📦 Установка / Installation

### Требования / Requirements:
- Node.js 18+
- npm 9+

### Шаги / Steps:

1. **Клонируйте репозиторий** / Clone repository:
```bash
git clone https://github.com/belyassh/Mini-twitter.git
cd Mini-twitter
```

2. **Установите зависимости** / Install dependencies:
```bash
npm install
```

3. **Запустите сервер** / Start server:
```bash
npm start
```

4. **Откройте приложение** / Open application:
```
http://localhost:3000
```

---

## 🚀 Использование / Usage

### Регистрация / Registration:
1. Перейдите на вкладку "Вход" / Go to "Auth" tab
2. Заполните форму регистрации / Fill registration form
3. Нажмите "Зарегистрироваться" / Click "Register"

### Создание твита / Creating a Tweet:
1. На вкладке "Моя лента" / In "My Feed" tab
2. Напишите текст в текстовом поле / Write text in the input field
3. Опционально: загрузите изображение / Optionally: upload an image
4. Нажмите "Поделиться" / Click "Share"

### Подписка на пользователей / Following Users:
1. Посетите профиль пользователя / Visit user's profile
2. Нажмите кнопку "Подписаться" / Click "Follow" button
3. Посты подписанного пользователя появятся в вашей ленте / Their posts will appear in your feed

### Смена языка / Changing Language:
1. Используйте селектор языков в верхнем меню / Use language selector in header
2. Выберите нужный язык / Select desired language
3. Интерфейс обновится автоматически / Interface updates automatically

### Смена темы / Changing Theme:
1. Нажмите кнопку 🌙/☀️ в верхнем меню / Click 🌙/☀️ button in header
2. Тема переключится мгновенно / Theme switches instantly

---

## 📡 API Endpoints

### Аутентификация / Authentication:
- `POST /api/register` - Регистрация / Register new user
- `POST /api/login` - Вход / Login
- `POST /api/logout` - Выход / Logout

### Твиты / Tweets:
- `GET /api/tweets` - Получить все твиты / Get all tweets
- `GET /api/tweets/:id` - Получить твит по ID / Get tweet by ID
- `POST /api/tweets` - Создать твит / Create new tweet
- `DELETE /api/tweets/:id` - Удалить твит / Delete tweet
- `GET /api/users/:id/tweets` - Получить твиты пользователя / Get user's tweets

### Пользователи / Users:
- `GET /api/users/:id/profile` - Получить профиль / Get user profile
- `POST /api/users/:id/follow` - Подписаться / Follow user
- `POST /api/users/:id/unfollow` - Отписаться / Unfollow user
- `GET /api/users/:id/following` - Получить подписки / Get following list

### Лайки / Likes:
- `POST /api/tweets/:id/like` - Добавить лайк / Like tweet
- `POST /api/tweets/:id/unlike` - Убрать лайк / Unlike tweet

### Уведомления / Notifications:
- `GET /api/notifications` - Получить уведомления / Get notifications

---

## 📁 Структура проекта / Project Structure

```
Mini-twitter/
├── public/
│   ├── index.html          # Главный HTML файл
│   ├── i18n.js             # Система переводов (10 языков)
│   └── styles.css          # Основные стили
├── server.mjs              # Express сервер
├── database.db             # SQLite база данных
├── package.json            # Зависимости
├── README.md               # Этот файл
└── requests.http           # HTTP запросы для тестирования
```

---

## 🗄️ Структура БД / Database Schema

### Users Table:
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### Tweets Table:
```sql
CREATE TABLE tweets (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
)
```

### Likes Table:
```sql
CREATE TABLE likes (
  id INTEGER PRIMARY KEY,
  tweet_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  FOREIGN KEY (tweet_id) REFERENCES tweets(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(tweet_id, user_id)
)
```

### Follows Table:
```sql
CREATE TABLE follows (
  id INTEGER PRIMARY KEY,
  follower_id INTEGER NOT NULL,
  following_id INTEGER NOT NULL,
  FOREIGN KEY (follower_id) REFERENCES users(id),
  FOREIGN KEY (following_id) REFERENCES users(id),
  UNIQUE(follower_id, following_id)
)
```

### Notifications Table:
```sql
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  type TEXT,
  related_user_id INTEGER,
  related_tweet_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
)
```

---

## 🧪 Тестирование / Testing

Используйте `requests.http` файл для тестирования API:

```http
### Register
POST http://localhost:3000/api/register
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123"
}

### Login
POST http://localhost:3000/api/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

---

## 🐛 Известные проблемы / Known Issues

Нет известных проблем / No known issues

---

## 📝 Лицензия / License

MIT License - свободен к использованию / Free to use

---

## 👨‍💻 Автор / Author

**belyassh**

---

## 📈 Версионирование / Versioning

- **v1.0** (2026-06-20) - Первый релиз / First release
  - Полная функциональность аутентификации / Full authentication
  - Система твитов с лайками / Tweet system with likes
  - Профили и подписки / Profiles and following
  - Поддержка 10 языков / 10 language support
  - Светлая и тёмная темы / Dark and Light themes
  - Система уведомлений / Notification system

---

**Спасибо за использование Mini-twitter! / Thank you for using Mini-twitter!** 🚀