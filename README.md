<div align="center">

# KometaManga

Metadata fetcher for [Komga](https://komga.org): covers, metadata, post-processing, source browsing, auto-downloading, and notifications for manga/comic libraries.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/iCosiSenpai/KometaManga?include_prereleases&label=Release)](https://github.com/iCosiSenpai/KometaManga/releases)
[![Docker Image](https://img.shields.io/badge/ghcr.io-kometamanga-blue?logo=docker)](https://ghcr.io/icosisenpai/kometamanga)
[![Smoke Tests](https://github.com/iCosiSenpai/KometaManga/actions/workflows/smoke-tests.yml/badge.svg)](https://github.com/iCosiSenpai/KometaManga/actions/workflows/smoke-tests.yml)

A modern Komga-focused remake of [Snd-R/komf](https://github.com/Snd-R/komf), with full credit to Snd-R for the original project.

[![PayPal](https://img.shields.io/badge/PayPal-Donate-blue?logo=paypal&logoColor=white)](https://paypal.me/AlessioCosi)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support-yellow?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/icosisenpai)

</div>

---

## Features

- Komga-only focus with a modern built-in web UI
- Browse manga across 6 sources (MangaDex, ComicK, MangaFire, WeebCentral, MangaPill, MangaWorld)
- Follow manga and auto-download new chapters
- Automatic metadata updates from 14+ providers
- Per-library providers and metadata behavior
- Batch identify/match/reset workflows
- Job tracking (live events, cancel/retry)
- Discord and Apprise notifications
- Config validation, backup/restore, and scheduler support

---

## Changelog

### v1.0.0

- Initial public release of KometaManga as a standalone Komga-focused app
- Modern built-in web UI with setup, dashboard, downloads, jobs, libraries, and settings
- Browse manga across 6 live sources with grouped search, source health, and chapter queueing
- Follow manga and auto-download new chapters
- Metadata updates from 14+ providers with per-library behavior
- Discord and Apprise notifications
- Embedded docs, health checks, backup/restore, and source-aware operations tooling

---

## Quick Start (Docker)

### 1. Create a compose file

```yaml
services:
  kometamanga:
    image: ghcr.io/icosisenpai/kometamanga:latest
    container_name: kometamanga
    restart: unless-stopped
    ports:
      - "8085:8085"
    volumes:
      - ./config:/config
      # Mount Komga library folder(s) — downloads must land where Komga reads them
      - /path/to/komga/library:/libraries/main
      # - /path/to/another/library:/libraries/secondary
    environment:
      - KOMF_CONFIG_DIR=/config
      - JAVA_TOOL_OPTIONS=-Xmx512m
    networks:
      - kometahub

networks:
  kometahub:
    external: true
```

### 2. Create the shared network

```bash
docker network create kometahub
```

If Komga runs in another Docker stack, add `kometahub` as an external network there too.
If Komga runs on the host (not Docker), remove `networks` and use host IP for `KOMF_KOMGA_BASE_URI`.

### 3. Start

```bash
docker compose up -d
```

Open `http://your-host:8085` and finish setup from the web UI.

> **No `.env` needed.** All configuration is managed from the UI.
> Optionally lock values via environment variables — but env vars **block** UI changes to those fields.

---

## Downloads & Storage

KometaManga downloads manga chapters from 6 sources as CBZ archives. Downloaded files **must** land inside a Komga library folder so Komga can see them.

### Workflow

1. **Browse Sources** → search → pick chapters → download
2. **Auto-Downloader** → follow manga → new chapters download automatically
3. **Downloads** → monitor queue and history

### Volume mounting

Mount the same host folders that Komga reads:

```yaml
# Single library
volumes:
  - ./config:/config
  - /path/to/manga/library:/libraries/main

# Multiple libraries
volumes:
  - ./config:/config
  - /path/to/manga/library:/libraries/manga
  - /path/to/comics/library:/libraries/comics
```

Replace `/path/to/manga/library` and `/path/to/comics/library` with the actual host paths where your Komga libraries live (e.g. `/data/manga`, `/srv/comics`, `/volume1/media/manga`).

Set **Download directory** in the UI to the container path (e.g. `/libraries/main`).

The UI will auto-detect Komga library roots and offer them as one-click buttons.

### Auto-scan

Enable **Auto-scan after download** in Settings → Download Config so Komga triggers a library scan immediately when chapters finish downloading.

---

## Environment Variables

| Variable | Description |
|---|---|
| `KOMF_KOMGA_BASE_URI` | Komga URL, e.g. `http://komga:25600` |
| `KOMF_KOMGA_USER` | Komga username |
| `KOMF_KOMGA_PASSWORD` | Komga password |
| `KOMF_SERVER_PORT` | Server port (default `8085`) |
| `KOMF_LOG_LEVEL` | `INFO`, `DEBUG`, `WARN` |
| `KOMF_DISCORD_WEBHOOKS` | Discord webhooks (comma-separated) |
| `KOMF_APPRISE_URLS` | Apprise URLs (comma-separated) |
| `KOMF_CORS_ALLOWED_ORIGIN` | Restrict CORS to one origin |
| `KOMF_DOWNLOAD_DIR` | Download directory path |
| `KOMF_DOWNLOAD_CBZ_COMPRESSION` | `true` / `false` |
| `KOMF_DOWNLOAD_AUTO_SCAN` | `true` / `false` |

**Default (recommended):** configure everything from the UI. Only use env vars for values you want immutable after deploy.

---

## Configuration

On first boot, KometaManga creates `application.yml` in your config directory.

### Minimal config

```yaml
komga:
  baseUri: http://localhost:25600
  komgaUser: your-user@example.org
  komgaPassword: your-password
  eventListener:
    enabled: true
```

### Per-library overrides

```yaml
komga:
  metadataUpdate:
    default:
      libraryType: MANGA
      updateModes: [ API ]
      aggregate: false
    library:
      YOUR_LIBRARY_ID:
        updateModes: [ API ]
        aggregate: true

metadataProviders:
  defaultProviders:
    mangaUpdates:
      priority: 10
      enabled: true
  libraryProviders:
    YOUR_LIBRARY_ID:
      aniList:
        priority: 20
        enabled: true
```

### Aggregation

Set `aggregate: true` to merge data from multiple providers. The first match initializes metadata; following providers fill missing fields.

---

## Notifications

- **Discord**: `notifications.discord.webhooks` or `KOMF_DISCORD_WEBHOOKS`
- **Apprise**: `notifications.apprise.urls` or `KOMF_APPRISE_URLS`
- Custom [Velocity](https://velocity.apache.org/engine/2.3/user-guide.html) templates: `/config/discord/` and `/config/apprise/`

---

## HTTP API

API base path: `/api`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/komga/media-server/libraries` | List libraries |
| `GET` | `/api/komga/metadata/providers` | List providers |
| `GET` | `/api/komga/metadata/search?name=...` | Search provider results |
| `POST` | `/api/komga/metadata/identify` | Identify series/provider |
| `POST` | `/api/komga/metadata/match/library/{id}` | Match all series in library |
| `POST` | `/api/komga/metadata/match-bulk` | Bulk match multiple series |
| `POST` | `/api/komga/metadata/reset/library/{id}` | Reset library metadata |
| `GET` | `/api/jobs` | List jobs |
| `POST` | `/api/config/validate` | Validate config without applying |
| `GET` | `/api/manga/sources` | List manga sources |
| `GET` | `/api/manga/sources/health` | Source health checks |
| `GET` | `/api/version` | Version and update info |

---

## Troubleshooting

### KometaManga won't start or shows a database error

The config folder might not have the right permissions. Run this once to fix it:

```bash
docker run --rm -v ./config:/config alpine chown -R 1000:1000 /config
```

Then restart: `docker compose restart kometamanga`

### "Cannot connect to Komga" during setup

- If both Komga and KometaManga run in Docker, make sure they share the same network (`kometahub`) and use the **service name** as URL (e.g. `http://komga:25600`), not `localhost`.
- If Komga runs directly on your machine (not in Docker), use your machine's local IP instead (e.g. `http://192.168.1.100:25600`).

### Downloads don't appear in Komga

- The download directory must point to a path **inside a mounted Komga library folder**. For example, if you mounted `/path/to/manga/library:/libraries/main`, set the download dir to `/libraries/main`.
- Enable **Auto-scan after download** in Settings → Download Config so Komga picks up new files immediately.

### Jobs page doesn't update in real time

If you're behind a reverse proxy (NGINX, Caddy, etc.), it might be buffering the live event stream. Try increasing proxy timeouts or switching to direct access to confirm.

### Pages load but the UI looks broken or stuck

Hard-refresh your browser (`Ctrl+Shift+R` or `Cmd+Shift+R`) to clear cached assets after an update.

---

## Build from Source

```bash
./gradlew :komf-app:clean :komf-app:shadowJar
```

Output: `komf-app/build/libs/komf-app-1.0.0-all.jar`

Run standalone:

```bash
java -jar komf-app-1.0.0-all.jar /path/to/config
```

---

## Security

KometaManga is intended for trusted local networks.

- Do not expose port `8085` directly to the public internet
- Use a reverse proxy + authentication for remote access
- Keep secrets out of committed config files
- Restrict CORS with `KOMF_CORS_ALLOWED_ORIGIN`

---

## KometaHub

KometaManga is the first app in the **KometaHub** suite — self-hosted tools for manga, anime, and media management.

| App | Status | Description |
|-----|--------|-------------|
| **KometaManga** | ✅ Available | Metadata, sources, auto-download for Komga |
| **KometaReader** | 🔜 Planned | Next-gen manga reader and library manager |
| **KometaWatcher** | 🔜 Planned | Anime tracking and streaming integration |

All KometaHub apps share the `kometahub` Docker network and work together while remaining independent.

---

## Credits

- Original project: [Snd-R/komf](https://github.com/Snd-R/komf)
- KometaManga remake and UI: [iCosiSenpai](https://github.com/iCosiSenpai)

## License

MIT. See [LICENSE](LICENSE).
