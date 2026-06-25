FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --ignore-scripts; else npm install --ignore-scripts; fi

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build
RUN npm prune --production --ignore-scripts

FROM node:20-alpine AS runner

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

RUN mkdir -p /app/secrets && chown -R appuser:appgroup /app

USER appuser

EXPOSE 8787

ENV MCP_TRANSPORT=http
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
