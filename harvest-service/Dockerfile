# ─────────────────────────────────────────────
# Stage 1: Builder
# ─────────────────────────────────────────────
FROM rust:1.93-slim AS builder

RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Kopiramo ceo workspace (jer je build context root)
COPY . .

# Ulazimo u konkretan servis
WORKDIR /app/harvest-service

# Build samo tog servisa
RUN cargo build --release -p harvest-service


# ─────────────────────────────────────────────
# Stage 2: Runtime
# ─────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Kopiramo samo binar
COPY --from=builder /app/target/release/harvest-service /app/harvest-service

# Ako servis ima migrations
COPY --from=builder /app/harvest-service/migrations /app/migrations

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8003
CMD ["./harvest-service"]