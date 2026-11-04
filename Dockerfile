FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend ./backend
COPY src/shared/domain ./src/shared/domain
ENV NODE_ENV=production
USER node
CMD ["node", "--experimental-strip-types", "backend/server.ts"]
