# 🚀 Listai Backend - NestJS API

Чистый backend для приложения Listai, развернутый на Railway.

## 📋 Развертывание на Railway

### 1. Импорт из GitHub
- Зайдите на [Railway.app](https://railway.app)
- **New Project** → **Deploy from GitHub repo**
- Выберите репозиторий `debilll-backend`

### 2. Переменные окружения
В Railway Dashboard → **Variables** скопируйте содержимое файла `RAILWAY_ENV_VARS.txt`:

```bash
DATABASE_HOST=db.igbegpyynpbprccizgxn.supabase.co
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=rvPWIIk1lQiQUU6k
DATABASE_NAME=postgres
DATABASE_SSL=true
JWT_SECRET=super-secret-jwt-key-for-production-minimum-32-characters-long
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=Q6HqprSkdKYjZyR4Y5avfvBwe4Bi2JD0O0rCzXEJ+L70Z44Nanv9oHDcT5VSSTkGJ96fMMuqOW/Pp4RgLGGdhQ==
JWT_REFRESH_EXPIRES_IN=7d
REDIS_HOST=mighty-dane-20131.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=AU6jAAIncDFiZTE5ZmE2NzEzNjQ0YmQzOTNmNzUwOWI1YmExN2YxN3AxMjAxMzE
REDIS_TLS=true
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
PORT=3000
NODE_ENV=production
```

### 3. Проверка работы
После развертывания проверьте:
```
https://your-app-name.railway.app/api/v1/health
```

Должно вернуться:
```json
{
  "success": true,
  "message": "API is running",
  "timestamp": "..."
}
```

## 🛡️ Безопасность
- Никогда не коммитьте секреты в Git!
- Файл `RAILWAY_ENV_VARS.txt` содержит реальные секреты - используйте только для копирования в Railway
- Все секреты в Git игнорируются через `.gitignore`

## 📁 Структура проекта
```
├── src/
│   ├── app.module.ts          # Главный модуль
│   ├── auth/                  # Аутентификация (JWT)
│   ├── users/                 # Пользователи
│   ├── goals/                 # Цели и планы
│   ├── tasks/                 # Задачи
│   ├── messages/              # Сообщения чата
│   ├── openai/                # OpenAI интеграция
│   ├── integrations/          # Подписки и интеграции
│   └── plans/                 # Генерация планов
├── Dockerfile                 # Docker конфигурация
├── railway.json              # Railway конфигурация
├── package.json              # Зависимости
└── .env.example              # Шаблон переменных (без секретов)
```

## 🚀 Локальная разработка

```bash
# Установка зависимостей
npm install

# Создайте .env файл на основе .env.example
cp .env.example .env
# Заполните реальными секретами

# Запуск в режиме разработки
npm run start:dev

# Сборка для продакшена
npm run build
```

## 📡 API Endpoints

- `GET /api/v1/health` - Проверка здоровья API
- `POST /api/v1/auth/login` - Вход
- `POST /api/v1/auth/signup` - Регистрация
- `GET /api/v1/goals` - Получить цели пользователя
- `POST /api/v1/goals` - Создать цель
- `POST /api/v1/messages` - Отправить сообщение в чат

## 🗄️ База данных

Используется Supabase PostgreSQL с TypeORM.

### Основные таблицы:
- `users` - Пользователи
- `goals` - Цели
- `tasks` - Задачи
- `messages` - Сообщения чата
- `plans` - Сгенерированные планы

## 🔄 Очереди

Используется Redis (Upstash) + BullMQ для:
- Генерации планов через OpenAI
- Асинхронной обработки задач
