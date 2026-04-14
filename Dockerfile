# --- App build stage (frontend + backend) ---
FROM gradle:8.10.2-jdk17 AS app-builder

USER root
RUN apt-get update && apt-get install -y curl ca-certificates gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Layer caching: copy dependency definitions first
COPY build.gradle.kts settings.gradle.kts gradle.properties gradlew ./
COPY gradle/ gradle/
COPY komf-core/build.gradle.kts komf-core/build.gradle.kts
COPY komf-mediaserver/build.gradle.kts komf-mediaserver/build.gradle.kts
COPY komf-notifications/build.gradle.kts komf-notifications/build.gradle.kts
COPY komf-client/build.gradle.kts komf-client/build.gradle.kts
COPY komf-api-models/build.gradle.kts komf-api-models/build.gradle.kts
COPY komf-app/build.gradle.kts komf-app/build.gradle.kts

RUN sed -i 's/\r$//' gradlew && chmod +x gradlew \
    && ./gradlew dependencies --no-daemon || true

# Copy frontend and install npm dependencies (separate layer)
COPY frontend/package.json frontend/package-lock.json* frontend/
RUN cd frontend && npm ci

# Now copy all source code
COPY . .

# Fix line endings after final COPY (Windows CRLF -> Unix LF)
RUN sed -i 's/\r$//' gradlew && chmod +x gradlew

# Build the fat JAR, including bundled frontend assets.
RUN ./gradlew :komf-app:shadowJar --no-daemon

# --- Runtime stages ---
FROM eclipse-temurin:21-jre AS base-amd64

FROM eclipse-temurin:21.0.6_7-jre AS base-arm64

FROM eclipse-temurin:17-jre AS base-arm

FROM base-amd64 AS build-final

RUN apt-get update && apt-get install -y pipx curl \
    && rm -rf /var/lib/apt/lists/*

RUN pipx install --include-deps pipx \
    && /root/.local/bin/pipx install --global --include-deps apprise

# Create non-root user (use -o to allow UID reuse if 1000 already exists)
RUN useradd -m -u 1000 -o kometa \
    && mkdir -p /app /config \
    && chown -R kometa:kometa /app /config

WORKDIR /app
COPY --from=app-builder --chown=kometa:kometa /workspace/komf-app/build/libs/komf-app-*-all.jar ./app.jar

ENV LC_ALL=en_US.UTF-8
ENV KOMF_CONFIG_DIR="/config"

USER kometa

ENTRYPOINT ["java", "-jar", "app.jar"]
EXPOSE 8085

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8085/api/config || exit 1

LABEL org.opencontainers.image.title="KometaManga" \
      org.opencontainers.image.description="Metadata fetcher for Komga — remake of Komf by Snd-R" \
      org.opencontainers.image.url=https://github.com/iCosiSenpai/KometaManga \
      org.opencontainers.image.source=https://github.com/iCosiSenpai/KometaManga \
      org.opencontainers.image.vendor="iCosiSenpai"
