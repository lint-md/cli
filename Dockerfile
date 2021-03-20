FROM node:current-alpine

WORKDIR /usr/local/lint-md

COPY . .

RUN set -x \
    && yarn install --production \
    && yarn build \
    && ln -s /usr/local/lint-md/lib/lint-md.js /usr/local/bin/lint-md

ENTRYPOINT ["lint-md"]
