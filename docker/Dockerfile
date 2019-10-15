# Build the static files.
FROM node:alpine
RUN mkdir /lq
WORKDIR /lq

ADD package.json /lq/
RUN npm install

ADD tsconfig.json index.html app.sass .babelrc.js /lq/
ADD src/ /lq/src/
ADD themes/ /lq/themes/
RUN npm run build

# Build the entrypoint binary.
FROM golang:alpine
ADD docker /lq/
WORKDIR /lq
RUN go build -mod=vendor -o lq-startup ./...

# Final image
FROM alpine:latest

RUN apk add --no-cache nginx
RUN rm /etc/nginx/conf.d/default.conf
RUN mkdir -p /run/nginx
RUN echo "daemon off;" >> /etc/nginx/nginx.conf

COPY --from=0 /lq/dist/ /lq
COPY --from=1 /lq/lq-startup /
COPY --from=1 /lq/nginx /templates/
COPY --from=1 /lq/config.json /templates/
WORKDIR /lq

ENTRYPOINT ["/lq-startup"]

