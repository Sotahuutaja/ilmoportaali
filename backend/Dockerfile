# Stage 1 — install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2 — final image
FROM node:20-alpine
WORKDIR /app

# Don't run as root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

COPY --from=deps /app/node_modules ./node_modules
COPY src/ ./src/
COPY package.json ./

EXPOSE 3000
CMD ["node", "src/index.js"]