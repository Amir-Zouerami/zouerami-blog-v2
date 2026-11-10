FROM alpine:3.22 AS download
ARG PB_VERSION=0.40.6
ARG TARGETARCH
RUN apk add --no-cache unzip wget \
 && wget -q -O /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH:-amd64}.zip" \
 && unzip /tmp/pb.zip pocketbase -d /pb

FROM alpine:3.22
RUN apk add --no-cache ca-certificates wget \
 && addgroup -S pb && adduser -S pb -G pb \
 && mkdir -p /pb_data /pb/pb_migrations && chown -R pb:pb /pb_data /pb
COPY --from=download /pb/pocketbase /pb/pocketbase
COPY entrypoint.sh /pb/entrypoint.sh
RUN chmod +x /pb/entrypoint.sh /pb/pocketbase
USER pb
VOLUME /pb_data
EXPOSE 8090
ENTRYPOINT ["/pb/entrypoint.sh"]
