FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY --from=builder /app/lib ./lib
RUN npm install --omit=dev && npm cache clean --force
RUN chmod +x /app/lib/src/lint-md.js && ln -s /app/lib/src/lint-md.js /usr/local/bin/lint-md
ENTRYPOINT ["lint-md"]
