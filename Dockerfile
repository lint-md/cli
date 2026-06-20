FROM node:22.22.1-alpine3.23 AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS builder
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22.22.1-alpine3.23 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY --from=builder /app/lib ./lib
RUN npm ci --omit=dev && npm cache clean --force
RUN chmod +x /app/lib/src/lint-md.js \
    && ln -s /app/lib/src/lint-md.js /usr/local/bin/lint-md \
    && chown -R node:node /app

USER node
ENTRYPOINT ["lint-md"]
