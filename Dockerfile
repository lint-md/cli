FROM node:22.22.1-alpine3.23 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22.22.1-alpine3.23
WORKDIR /app
COPY package*.json ./
COPY --from=builder /app/lib ./lib
RUN npm ci --omit=dev && npm cache clean --force
RUN chmod +x /app/lib/src/lint-md.js && ln -s /app/lib/src/lint-md.js /usr/local/bin/lint-md
ENTRYPOINT ["lint-md"]
