# Deployment Guide — Akademia Ora (Docker)

Production host: **Contabo VPS** · Domain via **Cloudflare** · URL: **https://admin.akademiaora.com**

The app runs as a single Docker container. Data is SQLite, stored on a Docker
volume (`akademia-ora-data`) so it survives rebuilds, restarts and updates.
nginx terminates TLS (Cloudflare Origin cert) and proxies to the container.

```
Browser ──HTTPS──> Cloudflare ──HTTPS (Origin cert)──> nginx :443 ──HTTP──> 127.0.0.1:3000 (container)
```

---

## 0. Prerequisites on the VPS

- Docker Engine + Docker Compose plugin (`docker --version`, `docker compose version`)
- nginx installed and running
- DNS: `admin.akademiaora.com` exists in Cloudflare, **proxied (orange cloud)** → VPS IP *(already done)*

---

## 1. Get the code onto the server

```bash
git clone https://github.com/PranveraN/Sistemi-ORA.git
cd Sistemi-ORA
```

> The repository does **not** contain a database. The `.db` files are gitignored.
> Production starts either empty (schema only) or with the real database you
> copy in (Step 4).

---

## 2. Configure environment

```bash
cp .env.production.example .env.production
# generate a strong secret:
openssl rand -base64 32
```

Edit `.env.production` and set **both** `AUTH_SECRET` and `NEXTAUTH_SECRET` to
that generated value. Leave `NEXTAUTH_URL`/`AUTH_URL` as
`https://admin.akademiaora.com`. Change `APP_PORT` only if 3000 is taken.

`.env.production` is gitignored — it holds secrets, never commit it.

---

## 3. Build and start

```bash
docker compose build      # builds the image ON this server (correct architecture)
docker compose up -d
docker compose logs -f     # watch startup; Ctrl+C to stop watching
```

On first start with no database, the entrypoint creates the schema as an
**empty** database (no users yet). Continue to Step 4 to load the real data,
**or** to test with demo data run:

```bash
docker compose exec app npx tsx prisma/seed.ts   # demo admin: admin@akademiaora.al / admin123
```

---

## 4. Import the REAL database  ← the important one

Your real records live in `akademia-ora.db` on the old Windows machine
(`...\Sistemi Ora\prisma\akademia-ora.db`). Bring that file to the server and
place it on the volume.

**4a. Stop the app** (so nothing is writing to the DB while you swap it):

```bash
docker compose down
```

**4b. Copy the real file to the server** (run from the Windows machine, or use
WinSCP/FileZilla to upload it to e.g. `/root/akademia-ora.db`):

```bash
scp "akademia-ora.db" user@YOUR_VPS_IP:/root/akademia-ora.db
```

**4c. Put it on the volume** under the exact name `akademia-ora.db`:

```bash
# Create the volume if it doesn't exist yet
docker volume create akademia-ora-data

# Copy the real DB into the volume using a throwaway container.
# IMPORTANT: chown the whole /data directory (-R), not just the file — the app
# runs as uid 1001 and must be able to create SQLite journal/WAL files in /data.
docker run --rm \
  -v akademia-ora-data:/data \
  -v /root/akademia-ora.db:/seed.db:ro \
  busybox sh -c "cp /seed.db /data/akademia-ora.db && chown -R 1001:1001 /data"
```

**4d. Start again** — the entrypoint detects the existing DB, **preserves your
data**, and brings the schema up to date for the deployed code version
(non-destructive):

```bash
docker compose up -d
docker compose logs -f      # should log: "Existing database found ... preserving data, syncing schema"
```

Log in with your real credentials. The demo logins will **not** work — this is
your real data now.

> Safety: the entrypoint never deletes or overwrites an existing database.
> Swapping the DB is always: `down` → replace the file on the volume → `up`.

---

## 5. nginx + Cloudflare TLS

1. In Cloudflare → **SSL/TLS → Origin Server → Create Certificate** (a wildcard
   `*.akademiaora.com` cert covers this subdomain). Save the certificate and
   private key on the VPS, e.g.:
   - `/etc/ssl/cloudflare/akademiaora.com.pem`
   - `/etc/ssl/cloudflare/akademiaora.com.key`
2. Set Cloudflare **SSL/TLS mode** to **Full (strict)**.
3. Install the site config (adjust the `ssl_*` paths if you saved the cert
   elsewhere, and `proxy_pass` port if you changed `APP_PORT`):

```bash
sudo cp deploy/nginx/admin.akademiaora.com.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/admin.akademiaora.com.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Visit **https://admin.akademiaora.com** — you should get the login page.

---

## 6. Backups (real financial data — do this)

Back up the single SQLite file. Quick manual backup:

```bash
docker run --rm -v akademia-ora-data:/data -v "$PWD":/backup busybox \
  cp /data/akademia-ora.db /backup/akademia-ora-backup-$(date +%F).db
```

> Student badge photos live on the same volume, under `/data/student-photos/`
> (no separate volume — they persist across rebuilds exactly like the DB
> file). The command above backs up the DB only; if you also want photos in
> the backup, copy the whole volume instead: `cp -r /data/* /backup/`.

Optional daily cron (3 AM, keep file with date):

```cron
0 3 * * * docker run --rm -v akademia-ora-data:/data -v /root/db-backups:/backup busybox sh -c 'cp /data/akademia-ora.db /backup/akademia-ora-$(date +\%F).db'
```

To restore: `docker compose down`, copy a backup over the volume file (as in
Step 4c), `docker compose up -d`.

---

## 7. Updating the app later

```bash
git pull
docker compose build
docker compose up -d
```

Your data on the volume is preserved. If a code update adds new tables or
columns, the container **applies them automatically and non-destructively on
startup** (it runs `prisma db push` without `--accept-data-loss`). You don't
need to do anything.

> If an update ever requires a *destructive* schema change (dropping/renaming a
> column), the container will refuse to start rather than risk data — back up
> first (Step 6), then apply it deliberately:
> `docker compose run --rm app npx prisma db push --accept-data-loss`

---

## 8. Common operations

| Task | Command |
|------|---------|
| View logs | `docker compose logs -f` |
| Restart | `docker compose restart` |
| Stop | `docker compose down` |
| Shell into container | `docker compose exec app bash` |
| Open Prisma Studio (debug DB) | `docker compose exec app npx prisma studio` |
| Reset a forgotten admin password | edit via Prisma Studio, or re-run a seed script |

---

## 9. Troubleshooting

- **Login fails / redirect loop:** check `AUTH_SECRET`/`NEXTAUTH_SECRET` are set
  and identical, `AUTH_TRUST_HOST=true`, and that nginx forwards
  `X-Forwarded-Proto https` (it does in the provided config).
- **502 from nginx:** container not up or wrong port — `docker compose ps`,
  confirm `proxy_pass` port == `APP_PORT`.
- **"empty database" on a deploy that should have real data:** the file on the
  volume isn't named exactly `akademia-ora.db`, or permissions are wrong — redo
  Step 4c (note the `chown 1001:1001`).
- **Cloudflare error 526 (invalid cert):** Origin cert path wrong, or SSL mode
  isn't Full (strict).
