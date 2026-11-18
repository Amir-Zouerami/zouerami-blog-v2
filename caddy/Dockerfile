# Certificate manager: Caddy built with the Parspack DNS module (github.com/caddy-dns/parspack).
# It only obtains and renews certificates (DNS-01 challenge, so wildcards work); nginx serves the traffic.
FROM caddy:2-builder AS builder
# Go module proxy. proxy.golang.org answers 403 to Iranian IPs for some modules: building from Iran needs
#   docker build --build-arg GOPROXY=https://goproxy.cn,https://goproxy.io,direct caddy
ARG GOPROXY=https://proxy.golang.org,direct
ENV GOPROXY=${GOPROXY}
RUN xcaddy build --with github.com/caddy-dns/parspack

FROM caddy:2
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile
