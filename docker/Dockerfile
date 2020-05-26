# Build the static files.
FROM node:12.16.3-alpine3.11
RUN mkdir /lq
WORKDIR /lq

ADD package.json /lq/
ADD package-lock.json /lq/
RUN npm install

ADD tsconfig.json index.html app.sass .babelrc.js lq.png CHANGELOG.json /lq/
ADD src/ /lq/src/
ADD themes/ /lq/themes/
RUN npm run build

# Build the entrypoint binary.
FROM golang:alpine
ADD docker /lq/
WORKDIR /lq
RUN go build -mod=vendor -o lq-startup ./...

# Final image
FROM nginx:alpine

COPY --from=0 /lq/dist/ /lq
COPY --from=1 /lq/lq-startup /
COPY --from=1 /lq/nginx /templates/
COPY --from=1 /lq/config.json /templates/

RUN adduser -u 1000 -D notroot
RUN touch /var/run/nginx.pid
RUN chown notroot /lq /etc/nginx/conf.d/ /var/cache/nginx/ /var/run/nginx.pid
# Don't bind to port 80, since we can't as non-root
RUN rm /etc/nginx/conf.d/default.conf

WORKDIR /lq
USER 1000
ENTRYPOINT ["/lq-startup"]

