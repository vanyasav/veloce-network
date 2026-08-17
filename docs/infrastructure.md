# Инфраструктура

## VPS

- Алиас в SSH-конфиге: `vpnmain` → `57.129.40.28` (IPv6:
  `2001:41d0:701:1100::be18`)
- Ubuntu 24.04.4 LTS, 4 vCPU, 7.6GB RAM, 72GB диск (~60GB свободно после
  чистки Docker-кэша 17.08.2026)
- Docker 29.5.2 + Compose v5.1.4 уже стояли
- Passwordless sudo для пользователя `ubuntu`
- **Не выделенный сервер** — уже хостил до нас:
  - `polymarket-snapshot-worker-hf1` / `-worker2` — торговый бот
  - `polymarket-alloy` — Grafana Alloy (мониторинг)
  - `node` (`pasarguard/node`) — VPN-нода (объясняет hostname `vpnmain`)
  - Caddy как системный сервис (не в Docker), уже обслуживал
    `veloce-network.xyz` (apex-домен) под VPN-сервис

## Домены

- `veloce-network.xyz` — куплен на Porkbun, **уже занят** под VPN-сервис
  (apex-домен, `/sub/*` проксирует на VPN-подписку, остальное — страница-
  прикрытие). Не трогать.
- `panel.veloce-network.xyz` — A-запись на `57.129.40.28`, добавлена
  17.08.2026, обслуживает Directus admin
- У клиентских сайтов пока нет кастомных доменов — используют
  `<slug>.pages.dev` от Cloudflare. Когда появится реальный клиент с
  доменом: добавить в Cloudflare Pages → проект → Custom domains

## Caddy

Системный (не в Docker), конфиг `/etc/caddy/Caddyfile`. Бэкапится перед
каждой правкой (`Caddyfile.bak.<timestamp>` рядом).

```caddyfile
veloce-network.xyz {
	handle /sub/* {
		reverse_proxy https://127.0.0.1:8000 {
			transport http {
				tls_insecure_skip_verify
			}
		}
	}
	handle {
		root * /var/www/check
		file_server
	}
}

panel.veloce-network.xyz {
	handle /webhook/* {
		reverse_proxy 127.0.0.1:8099
	}
	handle {
		reverse_proxy 127.0.0.1:8055
	}
}
```

Применение изменений: `sudo caddy validate --config /etc/caddy/Caddyfile`
затем `sudo systemctl reload caddy` (reload, не restart — не роняет
существующие соединения).

## Docker-стеки на VPS

### `~/directus-cms/` — CMS

`docker-compose.yml`: два сервиса, `database` (postgres:16-alpine,
volume `db_data`) и `directus` (directus/directus:11, порт `8055`
только на `127.0.0.1`, volume `directus_uploads`). Секреты — в
`~/directus-cms/.env` (права `600`): `DIRECTUS_KEY`, `DIRECTUS_SECRET`,
`DB_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

Управление: `cd ~/directus-cms && docker compose {up -d|logs|ps|down}`.

### `~/deploy/` — билд/деплой сервис

```
~/deploy/
  docker-compose.yml
  webhook-server/
    Dockerfile        # node:22-alpine, копирует server.js + template
    server.js          # HTTP-сервер: POST /webhook/build
    .env                # WEBHOOK_SECRET, DIRECTUS_URL, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
  restaurant-template/  # копия Astro-шаблона (синхронизируется вручную из локального репо)
```

Образ собирает шаблон внутри себя (`npm ci` на этапе build), так что
`wrangler`/`astro` доступны как `node_modules/.bin/*` без `npx` (см.
[automation-pipeline.md](./automation-pipeline.md) — там объяснено,
почему `npx` не взлетел).

Порт `8099` — только на `127.0.0.1` хоста; сервис слушает `0.0.0.0`
*внутри* контейнера (иначе docker-proxy не достучится — на loopback
внутри контейнера трафик с моста не приходит).

Обновление шаблона на сервере после локальных правок:
```bash
rsync -az --exclude node_modules --exclude dist --exclude .env \
  ~/Documents/websites/restaurant-template/ vpnmain:~/deploy/restaurant-template/
ssh vpnmain 'cd ~/deploy && docker compose up -d --build'
```

## Cloudflare

- Аккаунт: Account ID `ad86a2e90e62b1b712addce2a2343042`
- API-токен: скоуп только `Account → Cloudflare Pages → Edit` (минимальный,
  осознанно — `wrangler whoami` из-за этого не работает без явного
  `CLOUDFLARE_ACCOUNT_ID`, это нормально и ожидаемо)
- Один Pages-проект на клиента, имя проекта = `slug` ресторана в Directus
- Токен и Account ID хранятся в `~/deploy/webhook-server/.env` и
  `~/scripts/.env` на VPS

## Инвентарь секретов (где что лежит, не значения)

| Секрет | Где хранится | Для чего |
|---|---|---|
| `DIRECTUS_KEY`/`DIRECTUS_SECRET` | `~/directus-cms/.env` (VPS) | внутренние ключи Directus |
| `DB_PASSWORD` (Postgres) | `~/directus-cms/.env` (VPS) | БД Directus |
| `ADMIN_EMAIL`/`ADMIN_PASSWORD` (Directus) | `~/directus-cms/.env` (VPS) + у владельца в менеджере паролей | логин в админку |
| `DIRECTUS_STATIC_TOKEN` | `~/scripts/.env` (VPS) | для `onboard-restaurant.py`, бессрочный токен админа |
| `WEBHOOK_SECRET` | `~/deploy/webhook-server/.env` (VPS) | авторизация Directus Flow → build-webhook |
| `CLOUDFLARE_API_TOKEN` | `~/deploy/webhook-server/.env` + `~/scripts/.env` (VPS) | деплой на Cloudflare Pages |

Все файлы с секретами — права `600`, владелец `ubuntu`. Ничего из этого
не должно попадать в git-репозиторий шаблона.
