# Astro-шаблон сайта ресторана

Исходники: `~/Documents/websites/restaurant-template` (локально), копия
для деплоя: `~/deploy/restaurant-template` (на VPS, синхронизируется
вручную через `rsync`, см. [infrastructure.md](./infrastructure.md)).

Стек: Astro 7, Tailwind CSS v4 (через `@tailwindcss/vite`, не
классический PostCSS-плагин), TypeScript, `wrangler` как devDependency
(нужен для деплоя внутри контейнера, версия `^4.123.0`).

## Как шаблон получает данные

Один и тот же код деплоится под каждого клиента — различие только в
переменных окружения на этапе сборки:

```
DIRECTUS_URL=https://panel.veloce-network.xyz   # по умолчанию, редко меняется
RESTAURANT_SLUG=demo-pizzeria                     # какой ресторан собирать
```

`src/lib/directus.ts` — единственное место, которое ходит в Directus:

- `getRestaurant()` — читает строку `restaurants` по `slug` через
  публичный API (без токена, см. directus-cms.md — public policy)
- `getMenu(restaurantId)` — читает `menu_categories` + `menu_items`
  параллельно (`Promise.all`)
- `assetUrl(fileId, params)` — собирает URL на `/assets/<id>` с
  трансформацией (`?width=...&format=webp&quality=...`) — Directus сам
  генерирует нужный размер/формат на лету

Всё это выполняется **на этапе `astro build`** (в frontmatter, не в
браузере) — на выходе чистый статический HTML, в браузер JS для этого
не уходит.

## Структура страницы (`src/pages/index.astro`)

Одностраничник из секций:

```
Layout (общий <head>, CSS-переменные --color-primary/--color-secondary
        из данных ресторана)
 └─ Header   — sticky, гамбургер на мобильном
 └─ Hero     — фото на весь экран, CTA "Vedi il menu" / "Prenota"
 └─ About    — текст "Chi siamo" (если задан)
 └─ MenuSection — по категориям, сетка карточек блюд
 └─ Hours    — таблица часов работы
 └─ ContactFooter — адрес/телефон/email, ссылка на Google Maps
```

## Адаптивность (mobile-first)

Проверено вживую на 375px/768px/900px (через вложенные `iframe` — см.
заметку про resize_window ниже) — 17.08.2026:

- **Навигация**: мобильное меню через чистый CSS чекбокс-хак
  (`<input type="checkbox" class="peer hidden">` + `peer-checked:flex`)
  — работает без JavaScript вообще, надёжнее и быстрее, чем JS-toggle
- **Hero**: кнопки CTA — колонка на мобильном (`flex-col`), ряд на
  десктопе (`sm:flex-row`)
- **Меню**: сетка карточек — 1 колонка на мобильном, 2 на `sm:` и выше
  (`grid-cols-1 sm:grid-cols-2`)
- Все тач-элементы — минимум ~44px высоты
- `text-wrap: balance` на заголовке hero, чтобы не переносился некрасиво

### Заметка про тестирование в этом окружении

`resize_window` (Claude-in-Chrome MCP) не работает в этой песочнице —
физический экран фиксирован (2560px), окно не ужимается, несмотря на
"успешный" ответ инструмента. Рабочий обход: инжектить `<iframe>`
фиксированной ширины через `javascript_tool` и скриншотить его — iframe
получает собственный независимый viewport вне зависимости от размера
окна браузера. Актуально для будущих проверок дизайна.

## i18n

Данные уже мультиязычные (JSON `{it, en}` на полях name/description
меню), но сам шаблон пока рендерит **только один язык за раз**
(параметр `lang` в `MenuSection`, дефолт `it`, с fallback на первый
доступный ключ). Полноценный `/it/`/`/en/` роутинг с переключателем —
не реализован, это следующий шаг при реальном спросе от клиента с
туристическим потоком.

## Что не реализовано (сознательно, для MVP)

- Галерея фото (было в изначальном плане схемы, вырезано ради простоты
  — можно добавить как m2m-коллекцию к `directus_files` позже)
- Онлайн-бронирование/заказ — вне скоупа шаблона, для этого Astro не
  сильная сторона (см. business-strategy.md, там это обсуждалось) —
  при необходимости встраивать отдельный React/Vue-остров
- Переключатель языка в UI

## Локальная разработка

```bash
cd ~/Documents/websites/restaurant-template
npm run dev          # или: astro dev --background (см. AGENTS.md/CLAUDE.md проекта)
npm run build        # собирает dist/ с текущими .env
```

`.env` в корне репозитория (не коммитить) задаёт `DIRECTUS_URL` и
`RESTAURANT_SLUG` для локальной сборки/дев-сервера.
