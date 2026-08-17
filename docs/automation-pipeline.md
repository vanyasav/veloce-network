# Пайплайн автосборки/деплоя

## Общий поток

```
Правка в Directus
  → Flow (event hook) резолвит restaurant_id
  → POST https://panel.veloce-network.xyz/webhook/build
     (заголовок X-Webhook-Secret, тело {"restaurant_id": N})
  → build-webhook контейнер:
       1. GET restaurant по id/slug через публичный Directus API
       2. если status != published → пропустить (лог, без ошибки)
       3. astro build (node_modules/.bin/astro, cwd = шаблон,
          env RESTAURANT_SLUG=<slug>)
       4. wrangler pages deploy dist --project-name <slug> --branch main
  → живой сайт обновлён (~10-20 сек от правки до прода)
```

Очередь в `build-webhook` — простой in-memory FIFO с одним воркером
(`building` флаг) — если правки идут пачкой, билды не накладываются
друг на друга, выполняются по очереди.

## Directus Flows — 6 штук, зачем именно так

Изначально пытались сделать 3 Flow (по одному на коллекцию, scope
`["items.create","items.update"]` вместе) — не сработало из-за
асимметрии в структуре `$trigger` у Directus:

| Событие | Что доступно | Чего нет |
|---|---|---|
| `items.create` | `$trigger.key` (одиночный id) | `$trigger.keys` |
| `items.update` | `$trigger.keys` (массив id) | `$trigger.key` (пусто/undefined) |

Из-за этого пришлось разбить на 6 отдельных Flow — по одному на
(коллекция × тип события), в каждом однозначный шаблон:

- `Publish: restaurants create` — `{{$trigger.key}}`
- `Publish: restaurants update` — `{{$trigger.keys[0]}}`
- `Publish: menu_categories create/update` — читает `restaurant`
  через промежуточную операцию `item-read` (ключ = вышеуказанные
  выражения), затем шлёт `{{$last.restaurant}}`
- `Publish: menu_items create/update` — аналогично

**Вторая грабля**: результат одиночного `item-read` (когда передан
`key`, а не `query`-фильтр) — это **объект**, не массив. Шаблон
`{{$last[0].restaurant}}` резолвился в `undefined`. Правильно:
`{{$last.restaurant}}`.

Диагностика велась через временную подмену `body` операции на
`{"debug": {{$trigger}} }` / `{"debug_last": {{$last}} }` и логирование
сырого тела запроса на стороне `build-webhook` (потом убрано из кода —
если понадобится отладка снова, добавить обратно временно).

**`items.delete` не покрыт** — удаление ресторана/категории/блюда не
триггерит автоматический ребилд. Осознанный компромисс для MVP: событие
delete не даёт доступа к данным удалённой записи (некуда взять
`restaurant_id`), а сценарий "удалили блюдо и сразу нужно, чтобы оно
исчезло с сайта" — редкий; toggle `available: false` (это update,
работает) закрывает большинство случаев.

## Контейнер `build-webhook`

`~/deploy/webhook-server/server.js` — минимальный HTTP-сервер на
чистом Node (`http` + глобальный `fetch`, без npm-зависимостей).
Ключевые решения и грабли:

- **Слушает `0.0.0.0` внутри контейнера**, не `127.0.0.1` — при
  `127.0.0.1` внутри контейнера docker-proxy не мог достучаться
  (трафик с моста, не loopback), запросы падали с
  `Connection reset by peer`. Наружу всё равно закрыто — docker-compose
  маппит порт как `127.0.0.1:8099:8099` на хосте.
- **Не использует `npx`** для запуска `astro`/`wrangler` — `spawn npx
  ENOENT` внутри alpine-контейнера (PATH резолвился, но что-то в
  цепочке ломалось). Решение: вызывать бинарники напрямую —
  `node_modules/.bin/astro`, `node_modules/.bin/wrangler`.
- **`TEMPLATE_DIR` не должен быть в `.env`, если он там прописан под
  хостовый путь** — Dockerfile задаёт `ENV TEMPLATE_DIR=/app/template`
  по умолчанию, но `env_file` в docker-compose перебивает это, если
  переменная там тоже есть. Держать эту переменную только в одном
  месте (в `Dockerfile`, не в `.env`).

## Проверка после любых изменений в пайплайне

Минимальный regression-тест — вручную:

```bash
# на VPS, посмотреть что реально слушает и отвечает
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://panel.veloce-network.xyz/webhook/build   # ожидаем 401 без секрета

# с секретом и валидным restaurant_id (опубликованным) — 202,
# смотреть логи: docker compose -f ~/deploy/docker-compose.yml logs -f
```

Полный end-to-end (без ручного вызова webhook, только правка в
Directus → проверка на живом `.pages.dev`) — самый надёжный тест,
прогонялся 17.08.2026 дважды (для `restaurants` и для `menu_items`),
оба раза подтверждено.
