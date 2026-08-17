# Онбординг нового клиента

## Быстрый путь — скрипт

На VPS, `~/scripts/onboard-restaurant.py` (полная документация опций —
`~/scripts/README.md`, дублируется здесь для полноты):

```bash
ssh vpnmain
cd ~/scripts
set -a; source .env; set +a
python3 onboard-restaurant.py \
  --name "Trattoria da Sofia" --slug trattoria-da-sofia \
  --phone "+39 320 555 1212" --email info@trattoriadasofia.it \
  --address "Piazza del Duomo 3, Firenze" \
  --owner-email owner-sofia@trattoriadasofia.it \
  --publish
```

Делает по порядку: создаёт Cloudflare Pages проект (важно — **до**
создания ресторана, иначе первый автобилд упадёт на "project not
found") → создаёт строку `restaurants` в Directus → если дан
`--owner-email`, создаёт логин с ролью Restaurant Owner и случайным
паролем (печатается один раз в вывод — сразу передать клиенту и
попросить сменить).

`--slug` — только строчные латинские буквы/цифры/дефисы, становится и
именем Cloudflare Pages проекта, и частью URL (`<slug>.pages.dev`).

Без `--publish` — ресторан создаётся как `draft`, ничего не
собирается/не деплоится, пока статус не переключить на `published`
(вручную в Directus admin — любая правка черновика после этого
автоматически соберёт и задеплоит).

## Ручной путь (если скрипта под рукой нет)

1. Cloudflare dashboard (или `wrangler pages project create <slug>
   --production-branch main`) — создать Pages-проект
2. Directus admin → Content → Restaurants → создать запись, заполнить
   поля, `status: draft` пока контент не готов
3. Проверить меню (категории → блюда) — минимум пара блюд, иначе
   секция меню на сайте пустая (не ошибка, просто пусто)
4. Directus admin → Users → создать пользователя, роль "Restaurant
   Owner", поле `restaurant` → выбрать созданную запись
5. Когда контент готов — переключить `status` на `published` (или
   сразу создавать как `published`, если контент уже есть) — это
   триггернет первый автобилд

## Домен клиента

Когда у клиента есть свой домен:

1. Cloudflare Pages → проект → **Custom domains** → добавить домен
2. Cloudflare покажет, какую DNS-запись добавить у регистратора клиента
   (обычно CNAME на `<slug>.pages.dev`, либо смена нейм-серверов на
   Cloudflare, если домен переводится под управление Cloudflare
   полностью — уточнять по ситуации, Cloudflare сам подсказывает
   нужный вариант в интерфейсе)
3. SSL-сертификат Cloudflare выпускает и обновляет сам

Поле `domain` в записи `restaurants` в Directus — пока информационное
(не используется автоматически шаблоном/пайплайном), для собственной
памяти какой домен у какого клиента.

## Чеклист "точно не забыть"

- [ ] Cloudflare Pages проект существует **до** первого `published`
- [ ] `slug` в Directus совпадает с именем Cloudflare Pages проекта
  (пайплайн полагается на это один-в-один)
- [ ] Мультиязычные поля (`name`/`description` в меню) заполнены хотя
  бы на IT, иначе на сайте будет пусто в этом месте
- [ ] Логин владельцу отправлен, попросить сменить пароль
- [ ] После первого реального клиента — see backups-and-recovery.md,
  подумать про offsite-бэкапы (сейчас только локально на VPS)

## Демо/тестовые записи в системе (не реальные клиенты)

- `demo-pizzeria` (Directus id 10) — первый демо-сайт, сделан вручную
  при разработке шаблона
- `trattoria-da-sofia` (Directus id 12) — создан скриптом
  `onboard-restaurant.py` для проверки, что онбординг работает целиком;
  есть тестовый логин владельца `owner-sofia@trattoriadasofia.it`

Обе — с фейковыми данными, можно удалить в любой момент (запись в
Directus + `wrangler pages project delete <slug>` в Cloudflare) без
последствий для реальных клиентов, когда они появятся.
