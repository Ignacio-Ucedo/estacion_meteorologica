FROM rust:1.80-slim AS builder
WORKDIR /app
COPY Cargo.toml .
COPY src/ src/
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /app/target/release/gateway-mock /usr/local/bin/gateway-mock
CMD ["gateway-mock"]
