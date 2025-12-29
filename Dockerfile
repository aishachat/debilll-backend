FROM node:18-alpine

# Устанавливаем curl для health checks
RUN apk add --no-cache curl

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем все зависимости (включая dev для сборки)
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Удаляем dev dependencies для уменьшения размера образа
RUN npm prune --production

# Открываем порт
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

# Запускаем приложение
CMD ["npm", "run", "start:prod"]
