# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Akademia Ora — production image
#
# Next.js 15 (App Router) + Prisma + SQLite.
#
# Notes:
#  * Debian (bookworm) base — Prisma's query engine + OpenSSL "just work"
#    here, unlike Alpine/musl which needs extra fiddling.
#  * The SQLite database is NOT baked into the image. It lives on a Docker
#    volume at /data and is created (schema only) on first start, or used
#    as-is if you have placed a real database there. See docker-entrypoint.sh.
#  * Build this image ON THE TARGET SERVER (docker compose build) so the
#    Prisma engine binary matches the host architecture.
# ---------------------------------------------------------------------------

# ---- Stage 1: build -------------------------------------------------------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# OpenSSL is needed by Prisma at build time (engine + client generation).
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies (including devDependencies — needed for the build and
# for the Prisma CLI used by the entrypoint).
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source and build.
COPY . .

# Generate the Prisma client, then build Next.js for production.
# A throwaway DATABASE_URL is provided so `prisma generate` never touches a
# real database during the build.
ENV DATABASE_URL="file:/tmp/build.db"
RUN npx prisma generate
RUN npm run build


# ---- Stage 2: runtime -----------------------------------------------------
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Bind the Next.js server to all interfaces inside the container so Docker
# can route traffic to it.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Run as an unprivileged user. Create it BEFORE copying so we can set
# ownership during COPY (--chown) instead of a `chown -R` afterwards, which
# would duplicate the whole app into an extra image layer (~1GB+ wasted).
RUN groupadd --gid 1001 nodejs \
    && useradd --uid 1001 --gid nodejs --create-home nextjs

# Bring over the built app. We ship the full node_modules (rather than the
# Next.js "standalone" trace) so the Prisma client, query engine and Prisma
# CLI are guaranteed to be present at runtime — important for a database the
# app must never lose track of.
COPY --from=builder --chown=nextjs:nodejs /app/package.json   /app/package-lock.json ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules   ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next          ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public         ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma         ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json  ./tsconfig.json

# Entrypoint: ensures the database schema exists, then starts the server.
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /data \
    && chown nextjs:nodejs /data

USER nextjs

EXPOSE 3000

# Simple healthcheck: the login page should always answer 200.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
