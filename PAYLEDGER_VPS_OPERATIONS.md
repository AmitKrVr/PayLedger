# PayLedger VPS Operations & Deployment Runbook

**Project:** PayLedger
**Environment:** Production
**Provider:** DigitalOcean
**Last documented:** 9 October 2026

---

## 1. Purpose

This document is the operational reference for the PayLedger production VPS.

It covers:

- Server architecture
- SSH access
- Application directory
- PostgreSQL
- Redis
- Node.js and pnpm
- GitHub access
- Production environment variables
- systemd services
- Nginx
- DNS
- HTTPS / Certbot
- Standard deployment
- Environment changes
- Admin bootstrap
- Logs
- Troubleshooting
- Reboot and recovery
- Final production verification

### Secret safety

Never store the following in this document or Git:

- Database passwords
- JWT secrets
- Payment webhook secrets
- API keys
- Private SSH keys
- Other production credentials

---

## 2. Production Architecture

```text
Internet
   |
   v
Nginx :80 / :443
   |
   +------------------------------+
   |              |               |
   v              v               v
User Panel     Admin Panel      Backend API
:3000          :3001            :5001
                                  |
                                  +------> PostgreSQL :5432
                                  |
                                  +------> Redis :6379
                                  |
                                  v
                             Payment Gateway
                                 :5002
```

Public domains:

```text
https://payledger.devamit.info
https://payledger-admin.devamit.info
https://payledger-api.devamit.info
https://payledger-gateway.devamit.info
```

Internal services:

```text
127.0.0.1:5432  PostgreSQL
127.0.0.1:6379  Redis
127.0.0.1:3000  User Panel
127.0.0.1:3001  Admin Panel
127.0.0.1:5001  Backend API
127.0.0.1:5002  Payment Gateway
```

Nginx is the public entry point.

---

## 3. Server Reference

| Item | Value |
|---|---|
| Provider | DigitalOcean |
| Public IPv4 | `168.144.210.205` |
| OS | Ubuntu 24.04.5 LTS |
| Linux application user | `root` |
| Application directory | `/root/PayLedger` |
| SSH user | `root` |

The application runs from:

```text
/root/PayLedger
```

---

## 4. SSH

The VPS is accessed as `root` using a dedicated SSH key from the Mac.

Preferred command:

```bash
ssh payledger-vps
```

Direct-IP command (also configured on the Mac to use the same key):

```bash
ssh root@168.144.210.205
```

Mac SSH configuration (`~/.ssh/config`):

```sshconfig
Host payledger-vps
    HostName 168.144.210.205
    User root
    IdentityFile ~/.ssh/payledger_vps
    IdentitiesOnly yes

Host 168.144.210.205
    User root
    IdentityFile ~/.ssh/payledger_vps
    IdentitiesOnly yes
```

The private key is stored on the Mac at `~/.ssh/payledger_vps`.
Never copy the private key into the VPS or share it. The corresponding public key is authorized for root SSH access on the VPS.

Effective SSH authentication settings:

```text
PubkeyAuthentication yes
PasswordAuthentication no
```

The active password-authentication setting is configured in `/etc/ssh/sshd_config.d/50-cloud-init.conf`; `/etc/ssh/sshd_config.d/99-payledger-auth.conf` also records `PasswordAuthentication no` and `PubkeyAuthentication yes`. Verify the effective values with `sshd -T` after any SSH configuration change.

Check them on the VPS:

```bash
sshd -T | grep -E '^(passwordauthentication|pubkeyauthentication) '
```

Keep an existing SSH session open while changing SSH configuration. Validate changes with `sshd -t`, reload with `systemctl reload ssh`, and test a new connection before closing the existing session.

After connecting, the application directory is:

```bash
cd /root/PayLedger
```

Closing SSH does not stop the production services.

```bash
exit
```

---

## 5. Ports

Check all listeners:

```bash
sudo ss -lntp
```

Expected PayLedger application ports:

```text
:22       SSH
:80       Nginx HTTP
:443      Nginx HTTPS
:3000     User Panel
:3001     Admin Panel
:5001     Backend API
:5002     Payment Gateway
127.0.0.1:5432    PostgreSQL
127.0.0.1:6379    Redis
```

PostgreSQL and Redis should remain local services.

Nginx is the public reverse proxy.

---

## 6. PostgreSQL

Installed PostgreSQL version:

```bash
sudo -u postgres psql -c "SELECT version();"
```

Current database:

```text
payledger
```

Application database user:

```text
payledger
```

Database connection is configured through:

```text
/root/PayLedger/.env
```

Never put the production database password into this document.

### PostgreSQL service

Check:

```bash
sudo systemctl status postgresql --no-pager
```

The Ubuntu PostgreSQL cluster wrapper can show `active (exited)` even when PostgreSQL itself is running.

Confirm the listener:

```bash
sudo ss -lntp | grep 5432
```

### PostgreSQL administrator shell

```bash
sudo -u postgres psql
```

Useful commands:

```sql
\l
\du
\dt
\q
```

### Application connection test

From `/root/PayLedger`, load the environment without printing it:

```bash
set -a
source .env
set +a

psql "$DATABASE_URL" -c "SELECT current_user, current_database();"
```

Expected database/user:

```text
payledger | payledger
```

---

## 7. Database Migrations

Database migrations are managed by the `@payledger/database` workspace.

Available commands:

```bash
pnpm --filter @payledger/database db:generate
pnpm --filter @payledger/database db:migrate
pnpm --filter @payledger/database db:push
pnpm --filter @payledger/database db:studio
```

### Production migration

Use:

```bash
cd /root/PayLedger
pnpm --filter @payledger/database db:migrate
```

Do not generate new migrations on production unless deliberately preparing a release.

Before applying a migration, make sure the intended code and migration files are present.

---

## 8. Redis

Check Redis:

```bash
redis-cli ping
```

Expected:

```text
PONG
```

Service:

```bash
sudo systemctl status redis-server --no-pager
```

Restart only when required:

```bash
sudo systemctl restart redis-server
```

Check listener:

```bash
sudo ss -lntp | grep 6379
```

Logs:

```bash
sudo journalctl -u redis-server --since "30 minutes ago" --no-pager
```

---

## 9. Node.js and pnpm

Production Node.js:

```text
v24.21.0
```

Check:

```bash
node --version
npm --version
pnpm --version
```

Production pnpm:

```text
11.25.0
```

The repository requires Node.js `>=24`.

The root project declares:

```text
pnpm@11.25.0
```

Always use the repository's pnpm workflow.

---

## 10. Project Structure

The PayLedger repository is a Turborepo monorepo.

```text
/root/PayLedger
├── apps/
│   ├── user-panel/
│   ├── admin-panel/
│   ├── backend/
│   └── payment-gateway/
├── packages/
│   ├── database/
│   ├── shared/
│   └── config/
├── .env
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── turbo.json
```

The application root is:

```text
/root/PayLedger
```

For normal operational work:

```bash
cd /root/PayLedger
```

You do not need to run `cd /root/PayLedger` before every command if you are already inside that directory.

---

## 11. GitHub

Repository:

```text
AmitKrVr/PayLedger
```

The repository is private.

The VPS uses a dedicated GitHub deploy key.

GitHub SSH host alias:

```text
github-payledger
```

Test:

```bash
ssh -T git@github-payledger
```

Expected authentication response indicates that GitHub authenticated the repository deploy key.

Application repository:

```bash
cd /root/PayLedger
git status
```

Always inspect Git state before deployment.

---

## 12. Production Environment

Production environment file:

```text
/root/PayLedger/.env
```

Permissions:

```text
-rw------- root:root
```

Check:

```bash
stat -c '%A %U:%G %n' /root/PayLedger/.env
```

Expected:

```text
-rw------- root:root /root/PayLedger/.env
```

Never commit `.env`.

Never print the complete `.env`.

### Important production values

The following production configuration is currently used:

```text
NODE_ENV=production

BACKEND_PORT=5001
PAYMENT_GATEWAY_PORT=5002

REDIS_URL=redis://127.0.0.1:6379

PAYMENT_GATEWAY_BASE_URL=http://127.0.0.1:5002

PAYLEDGER_WEBHOOK_URL=http://127.0.0.1:5001/api/v1/payments/webhook

CORS_ORIGINS=https://payledger.devamit.info,https://payledger-admin.devamit.info
```

Do not put secret values in this document.

### Environment changes

When changing `.env`:

1. Edit only the required variable.
2. Never print secrets.
3. Check file permissions.
4. Restart the affected service.
5. Verify the service.
6. Verify the public API/application.

Example:

```bash
nano /root/PayLedger/.env
```

Then:

```bash
stat -c '%A %U:%G %n' /root/PayLedger/.env
sudo systemctl restart payledger-backend
sudo systemctl is-active payledger-backend
curl -sS https://payledger-api.devamit.info/health
```

---

## 13. Frontend Production Environment

User panel:

```text
/root/PayLedger/apps/user-panel/.env.production
```

Admin panel:

```text
/root/PayLedger/apps/admin-panel/.env.production
```

Both currently use:

```env
NEXT_PUBLIC_API_URL=https://payledger-api.devamit.info/api
```

This value is included during the Next.js production build.

Therefore, after changing `NEXT_PUBLIC_API_URL`, rebuild the frontend:

```bash
pnpm build
```

Then restart the affected panel service.

---

## 14. systemd Services

PayLedger uses four systemd services.

```text
payledger-backend.service
payledger-payment-gateway.service
payledger-user-panel.service
payledger-admin-panel.service
```

All four services are enabled at boot.

### Backend

Service file:

```text
/etc/systemd/system/payledger-backend.service
```

Runs:

```text
/root/PayLedger/apps/backend/dist/index.js
```

Port:

```text
5001
```

Commands:

```bash
sudo systemctl status payledger-backend --no-pager
sudo systemctl start payledger-backend
sudo systemctl stop payledger-backend
sudo systemctl restart payledger-backend
sudo systemctl is-enabled payledger-backend
sudo systemctl is-active payledger-backend
```

Logs:

```bash
sudo journalctl -u payledger-backend --since "30 minutes ago" --no-pager
sudo journalctl -u payledger-backend -f
```

### Payment Gateway

Service file:

```text
/etc/systemd/system/payledger-payment-gateway.service
```

Runs:

```text
/root/PayLedger/apps/payment-gateway/dist/index.js
```

Port:

```text
5002
```

Commands:

```bash
sudo systemctl status payledger-payment-gateway --no-pager
sudo systemctl start payledger-payment-gateway
sudo systemctl stop payledger-payment-gateway
sudo systemctl restart payledger-payment-gateway
sudo systemctl is-enabled payledger-payment-gateway
sudo systemctl is-active payledger-payment-gateway
```

Logs:

```bash
sudo journalctl -u payledger-payment-gateway --since "30 minutes ago" --no-pager
sudo journalctl -u payledger-payment-gateway -f
```

### User Panel

Service file:

```text
/etc/systemd/system/payledger-user-panel.service
```

Port:

```text
3000
```

Commands:

```bash
sudo systemctl status payledger-user-panel --no-pager
sudo systemctl start payledger-user-panel
sudo systemctl stop payledger-user-panel
sudo systemctl restart payledger-user-panel
sudo systemctl is-enabled payledger-user-panel
sudo systemctl is-active payledger-user-panel
```

Logs:

```bash
sudo journalctl -u payledger-user-panel --since "30 minutes ago" --no-pager
sudo journalctl -u payledger-user-panel -f
```

### Admin Panel

Service file:

```text
/etc/systemd/system/payledger-admin-panel.service
```

Port:

```text
3001
```

Commands:

```bash
sudo systemctl status payledger-admin-panel --no-pager
sudo systemctl start payledger-admin-panel
sudo systemctl stop payledger-admin-panel
sudo systemctl restart payledger-admin-panel
sudo systemctl is-enabled payledger-admin-panel
sudo systemctl is-active payledger-admin-panel
```

Logs:

```bash
sudo journalctl -u payledger-admin-panel --since "30 minutes ago" --no-pager
sudo journalctl -u payledger-admin-panel -f
```

---

## 15. Check All PayLedger Services

Quick service check:

```bash
sudo systemctl is-active payledger-backend
sudo systemctl is-active payledger-payment-gateway
sudo systemctl is-active payledger-user-panel
sudo systemctl is-active payledger-admin-panel
sudo systemctl is-active nginx
sudo systemctl is-active postgresql
sudo systemctl is-active redis-server
```

Expected:

```text
active
active
active
active
active
active
active
```

Check boot enablement:

```bash
sudo systemctl is-enabled payledger-backend
sudo systemctl is-enabled payledger-payment-gateway
sudo systemctl is-enabled payledger-user-panel
sudo systemctl is-enabled payledger-admin-panel
sudo systemctl is-enabled nginx
```

---

## 16. Nginx

Nginx is the public reverse proxy.

Configuration:

```text
/etc/nginx/sites-available/payledger
```

Enabled configuration:

```text
/etc/nginx/sites-enabled/payledger
```

Current routing:

```text
payledger.devamit.info
   -> 127.0.0.1:3000

payledger-admin.devamit.info
   -> 127.0.0.1:3001

payledger-api.devamit.info
   -> 127.0.0.1:5001

payledger-gateway.devamit.info
   -> 127.0.0.1:5002
```

Test Nginx configuration before applying changes:

```bash
sudo nginx -t
```

Reload:

```bash
sudo systemctl reload nginx
```

Status:

```bash
sudo systemctl status nginx --no-pager
sudo systemctl is-enabled nginx
sudo systemctl is-active nginx
```

Logs:

```bash
sudo tail -n 100 /var/log/nginx/access.log
sudo tail -n 100 /var/log/nginx/error.log
```

Do not restart unrelated services when only an Nginx configuration change is required.

---

## 17. DNS

Main domain:

```text
devamit.info
```

PayLedger subdomains:

```text
payledger.devamit.info
payledger-admin.devamit.info
payledger-api.devamit.info
payledger-gateway.devamit.info
```

All four point to:

```text
168.144.210.205
```

DNS is authoritative through Vercel DNS:

```text
ns1.vercel-dns.com
ns2.vercel-dns.com
```

Check DNS:

```bash
dig +short payledger.devamit.info
dig +short payledger-admin.devamit.info
dig +short payledger-api.devamit.info
dig +short payledger-gateway.devamit.info
```

Check public resolvers:

```bash
dig +short payledger.devamit.info @1.1.1.1
dig +short payledger-api.devamit.info @1.1.1.1
```

If DNS is wrong, fix the authoritative DNS records before troubleshooting Nginx or Certbot.

---

## 18. HTTPS / Certbot

PayLedger uses Let's Encrypt.

Certificate covers:

```text
payledger.devamit.info
payledger-admin.devamit.info
payledger-api.devamit.info
payledger-gateway.devamit.info
```

Certificate location:

```text
/etc/letsencrypt/live/payledger.devamit.info/fullchain.pem
/etc/letsencrypt/live/payledger.devamit.info/privkey.pem
```

Check certificates:

```bash
sudo certbot certificates
```

Test renewal:

```bash
sudo certbot renew --dry-run
```

HTTP should redirect to HTTPS.

Example:

```bash
curl -I http://payledger.devamit.info
```

HTTPS test:

```bash
curl -I https://payledger.devamit.info
curl -I https://payledger-admin.devamit.info
curl -I https://payledger-api.devamit.info
curl -I https://payledger-gateway.devamit.info
```

---

## 19. Health Check

Backend health route:

```text
GET /health
```

Public URL:

```text
https://payledger-api.devamit.info/health
```

Check:

```bash
curl -sS https://payledger-api.devamit.info/health
```

Expected:

```json
{
  "status": "ok"
}
```

A successful response confirms:

```text
HTTPS
  -> Nginx
  -> Backend
  -> /health
```

---

## 20. Local Application Checks

Backend:

```bash
curl -sS http://127.0.0.1:5001/health
```

User panel:

```bash
curl -I http://127.0.0.1:3000
```

Admin panel:

```bash
curl -I http://127.0.0.1:3001
```

Payment gateway root route may return `404` because `GET /` is not necessarily a defined gateway route.

A `404` from the gateway root is not automatically a service failure.

---

## 21. Standard Production Deployment

Use this controlled sequence for an approved release.

### 1. SSH

```bash
ssh payledger-vps
```

### 2. Enter project

```bash
cd /root/PayLedger
```

### 3. Inspect Git

```bash
git status
git status --short
```

Do not continue if unexpected local changes or untracked files exist.

### 4. Pull intended release

```bash
git pull
```

For controlled releases, prefer a reviewed commit/tag rather than blindly deploying unknown remote state.

### 5. Install dependencies

```bash
pnpm install --frozen-lockfile
```

### 6. Typecheck

```bash
pnpm check-types
```

### 7. Build

```bash
pnpm build
```

### 8. Database migration

Only when the release contains migrations:

```bash
pnpm --filter @payledger/database db:migrate
```

### 9. Restart application services

```bash
sudo systemctl restart payledger-backend
sudo systemctl restart payledger-payment-gateway
sudo systemctl restart payledger-user-panel
sudo systemctl restart payledger-admin-panel
```

### 10. Verify services

```bash
sudo systemctl is-active payledger-backend
sudo systemctl is-active payledger-payment-gateway
sudo systemctl is-active payledger-user-panel
sudo systemctl is-active payledger-admin-panel
```

### 11. Verify API

```bash
curl -sS https://payledger-api.devamit.info/health
```

### 12. Review logs

```bash
sudo journalctl -u payledger-backend --since "5 minutes ago" --no-pager
sudo journalctl -u payledger-payment-gateway --since "5 minutes ago" --no-pager
sudo journalctl -u payledger-user-panel --since "5 minutes ago" --no-pager
sudo journalctl -u payledger-admin-panel --since "5 minutes ago" --no-pager
```

Do not compress the deployment into one blind shell command.

Step-by-step deployment makes failures visible.

---

## 22. Admin Bootstrap

PayLedger contains an admin creation script:

```text
apps/backend/src/scripts/create-admin.ts
```

Package script:

```text
admin:create
```

Run from the project root:

```bash
cd /root/PayLedger
pnpm --filter @payledger/backend admin:create
```

Do not create an admin by manually inserting password hashes into the database unless the application explicitly requires it.

Use the application's bootstrap script so password hashing and validation follow the application implementation.

---

## 23. Reboot and Shutdown

Closing SSH:

```bash
exit
```

does not stop PayLedger.

Reboot:

```bash
sudo reboot
```

Because the PayLedger services are enabled with systemd, they should automatically start after reboot.

After reconnecting:

```bash
cd /root/PayLedger
```

Check:

```bash
sudo systemctl is-active payledger-backend
sudo systemctl is-active payledger-payment-gateway
sudo systemctl is-active payledger-user-panel
sudo systemctl is-active payledger-admin-panel
sudo systemctl is-active nginx
sudo systemctl is-active postgresql
sudo systemctl is-active redis-server
```

Then:

```bash
curl -sS https://payledger-api.devamit.info/health
```

---

## 24. Troubleshooting: Backend Down

Run in this order:

```bash
sudo systemctl status payledger-backend --no-pager
```

Then:

```bash
sudo journalctl -u payledger-backend --since "15 minutes ago" --no-pager
```

Check port:

```bash
sudo ss -lntp | grep 5001
```

Check locally:

```bash
curl -sS http://127.0.0.1:5001/health
```

Check Nginx:

```bash
sudo systemctl status nginx --no-pager
```

Finally:

```bash
curl -sS https://payledger-api.devamit.info/health
```

Do not restart unrelated services without evidence.

---

## 25. Troubleshooting: 502 Bad Gateway

A `502 Bad Gateway` generally means Nginx cannot successfully reach its upstream.

For the backend:

```bash
sudo systemctl is-active payledger-backend
sudo ss -lntp | grep 5001
curl -sS http://127.0.0.1:5001/health
sudo nginx -t
sudo tail -n 100 /var/log/nginx/error.log
```

For the user panel:

```bash
sudo systemctl is-active payledger-user-panel
sudo ss -lntp | grep 3000
curl -I http://127.0.0.1:3000
```

For the admin panel:

```bash
sudo systemctl is-active payledger-admin-panel
sudo ss -lntp | grep 3001
curl -I http://127.0.0.1:3001
```

For the payment gateway:

```bash
sudo systemctl is-active payledger-payment-gateway
sudo ss -lntp | grep 5002
curl -i http://127.0.0.1:5002/
```

---

## 26. Troubleshooting: Database

Run:

```bash
sudo systemctl status postgresql --no-pager
```

Check listener:

```bash
sudo ss -lntp | grep 5432
```

Test the configured application connection:

```bash
cd /root/PayLedger

set -a
source .env
set +a

psql "$DATABASE_URL" -c "SELECT current_user, current_database();"
```

Check backend logs:

```bash
sudo journalctl -u payledger-backend --since "15 minutes ago" --no-pager
```

Do not reset credentials or recreate the production database as a first troubleshooting step.

---

## 27. Troubleshooting: Redis

Check:

```bash
sudo systemctl status redis-server --no-pager
redis-cli ping
sudo ss -lntp | grep 6379
```

Expected:

```text
PONG
```

If necessary:

```bash
sudo systemctl restart redis-server
sudo systemctl restart payledger-backend
```

Then verify:

```bash
curl -sS https://payledger-api.devamit.info/health
```

Review backend logs if the service does not recover.

---

## 28. Troubleshooting: HTTPS

Run:

```bash
sudo nginx -t
sudo systemctl status nginx --no-pager
sudo ss -lntp | grep 443
sudo certbot certificates
sudo certbot renew --dry-run
```

Then:

```bash
curl -Iv https://payledger-api.devamit.info/health
```

Verify:

- Certificate hostname matches.
- TLS verification succeeds.
- HTTPS request reaches Nginx.
- API returns the expected response.

---

## 29. Troubleshooting: DNS

Run:

```bash
dig +short payledger.devamit.info
dig +short payledger-admin.devamit.info
dig +short payledger-api.devamit.info
dig +short payledger-gateway.devamit.info
```

Public resolvers:

```bash
dig +short payledger.devamit.info @8.8.8.8
dig +short payledger.devamit.info @1.1.1.1

dig +short payledger-api.devamit.info @8.8.8.8
dig +short payledger-api.devamit.info @1.1.1.1
```

Authoritative nameservers:

```bash
dig +short NS devamit.info
```

If authoritative DNS is wrong, fix the DNS records before repeatedly changing Nginx.

---

## 30. Troubleshooting: Frontend

If the user panel or admin panel does not work:

Check service:

```bash
sudo systemctl status payledger-user-panel --no-pager
sudo systemctl status payledger-admin-panel --no-pager
```

Check logs:

```bash
sudo journalctl -u payledger-user-panel --since "15 minutes ago" --no-pager
sudo journalctl -u payledger-admin-panel --since "15 minutes ago" --no-pager
```

Check ports:

```bash
sudo ss -lntp | grep -E ':3000|:3001'
```

Check local services:

```bash
curl -I http://127.0.0.1:3000
curl -I http://127.0.0.1:3001
```

Check the production API variable:

```bash
grep -E '^NEXT_PUBLIC_API_URL=' \
  apps/user-panel/.env.production \
  apps/admin-panel/.env.production
```

Expected:

```text
https://payledger-api.devamit.info/api
```

If this value changes, rebuild:

```bash
pnpm build
```

Then restart the affected panel service.

---

## 31. Git and Secret Safety

Before deployment:

```bash
git status --short
```

Expected for a clean tree:

```text
(no output)
```

Check `.env` is ignored:

```bash
git check-ignore -v .env
```

Never use:

```bash
git add .
```

without first reviewing untracked files.

Never commit:

- `.env`
- database passwords
- JWT secrets
- webhook secrets
- private keys
- production credentials

---

## 32. Final Production Verification

### Services

```bash
sudo systemctl is-active payledger-backend
sudo systemctl is-active payledger-payment-gateway
sudo systemctl is-active payledger-user-panel
sudo systemctl is-active payledger-admin-panel
sudo systemctl is-active nginx
sudo systemctl is-active postgresql
sudo systemctl is-active redis-server
```

All should report:

```text
active
```

### Ports

```bash
sudo ss -lntp
```

Verify the expected PayLedger ports.

### API

```bash
curl -sS https://payledger-api.devamit.info/health
```

Expected:

```json
{"status":"ok"}
```

### User panel

```bash
curl -I https://payledger.devamit.info
```

Expected application response may redirect to:

```text
/login
```

### Admin panel

```bash
curl -I https://payledger-admin.devamit.info
```

Expected application response may redirect to:

```text
/login
```

### Payment gateway

```bash
curl -I https://payledger-gateway.devamit.info
```

A `404` on `/` can be normal when the gateway has no `GET /` route.

The important part is that the response comes from PayLedger/Nginx and not from an unrelated service.

### HTTPS

```bash
sudo certbot renew --dry-run
```

### Recent logs

```bash
sudo journalctl -u payledger-backend --since "10 minutes ago" --no-pager
sudo journalctl -u payledger-payment-gateway --since "10 minutes ago" --no-pager
sudo journalctl -u payledger-user-panel --since "10 minutes ago" --no-pager
sudo journalctl -u payledger-admin-panel --since "10 minutes ago" --no-pager
```

---

## 33. Production Release Checklist

```text
[ ] Correct release/commit confirmed
[ ] Git working tree reviewed
[ ] pnpm install --frozen-lockfile completed
[ ] Typecheck passed
[ ] Build passed
[ ] Database migration reviewed
[ ] Database migration completed if required
[ ] Backend restarted
[ ] Payment gateway restarted
[ ] User panel restarted
[ ] Admin panel restarted
[ ] All four application services active
[ ] Nginx active
[ ] PostgreSQL active
[ ] Redis active
[ ] /health returns 200
[ ] User panel accessible
[ ] Admin panel accessible
[ ] Payment gateway reachable
[ ] HTTPS works
[ ] HTTP redirects to HTTPS
[ ] Certificate renewal checked
[ ] Recent logs reviewed
[ ] No unexpected startup errors
```

---

## 34. Change Management

For production infrastructure changes:

1. Know what the change does.
2. Check the current state.
3. Make one logical change at a time.
4. Test configuration before reload/restart.
5. Verify the affected service.
6. Check logs.
7. Verify the public API.
8. Keep a working recovery path.

For Nginx changes:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

For systemd service changes:

```bash
sudo systemctl daemon-reload
sudo systemctl restart <service>
sudo systemctl is-active <service>
```

Do not restart unrelated services without a reason.

---

## 35. Golden Troubleshooting Flow

When something is broken, follow this order:

```text
Is the VPS reachable?
        |
        v
Is the required service running?
        |
        v
What do the service logs say?
        |
        v
Is the expected port listening?
        |
        v
Does the service work locally?
        |
        v
Does Nginx work?
        |
        v
Does DNS resolve correctly?
        |
        v
Does public HTTPS work?
```

Do not randomly restart every service.

Follow the dependency chain.

---

## 36. Quick Daily Operations

### Go to project

```bash
cd /root/PayLedger
```

### Check everything

```bash
sudo systemctl is-active payledger-backend
sudo systemctl is-active payledger-payment-gateway
sudo systemctl is-active payledger-user-panel
sudo systemctl is-active payledger-admin-panel
sudo systemctl is-active nginx
sudo systemctl is-active postgresql
sudo systemctl is-active redis-server
```

### API health

```bash
curl -sS https://payledger-api.devamit.info/health
```

### Backend logs

```bash
sudo journalctl -u payledger-backend -f
```

### Gateway logs

```bash
sudo journalctl -u payledger-payment-gateway -f
```

### User panel logs

```bash
sudo journalctl -u payledger-user-panel -f
```

### Admin panel logs

```bash
sudo journalctl -u payledger-admin-panel -f
```

### Nginx logs

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 37. Architecture Summary

```text
                        Internet
                           |
                           v
                    Nginx :80/:443
                           |
         +-----------------+------------------+
         |                 |                  |
         v                 v                  v
    User Panel        Admin Panel        Backend API
      :3000              :3001              :5001
                                              |
                                 +------------+------------+
                                 |                         |
                                 v                         v
                           PostgreSQL                   Redis
                            :5432                       :6379
                                 |
                                 |
                                 v
                        Payment Gateway
                             :5002
```

### Public endpoints

```text
User:
https://payledger.devamit.info

Admin:
https://payledger-admin.devamit.info

API:
https://payledger-api.devamit.info

Payment Gateway:
https://payledger-gateway.devamit.info
```

### Application directory

```text
/root/PayLedger
```

### Linux user

```text
devamit
```

### Production services

```text
payledger-backend.service
payledger-payment-gateway.service
payledger-user-panel.service
payledger-admin-panel.service
```

---

## 38. Operational Principle

The PayLedger VPS should be treated as production infrastructure:

- Make deliberate changes.
- Verify before and after changes.
- Keep secrets out of Git.
- Keep PostgreSQL and Redis private.
- Use Nginx as the public entry point.
- Use HTTPS.
- Keep systemd services enabled.
- Review logs before corrective action.
- Do not recreate production databases as a first troubleshooting step.
- Do not randomly restart unrelated services.
- Use the dependency chain when troubleshooting.
- Keep deployment steps visible and controlled.
