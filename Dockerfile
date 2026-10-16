FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
ENV DATABASE_URL=postgresql://unused:unused@localhost:5432/unused
ARG API_URL=http://api:4000
ENV API_URL=$API_URL
RUN npm run db:generate && npm run build

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000 4000
CMD ["node","apps/api/dist/main.js"]
