# Directus CMS

Админка: `https://panel.veloce-network.xyz/admin`. Directus 11 — модель
прав в этой версии построена на **Policies**, отдельных от Roles (Role
просто группирует Policies через junction `directus_access`; сами
правила лежат в Policy). Это ломает многие старые примеры/туториалы
под Directus ≤9 — если гуглите, проверяйте версию.

## Схема данных

```
restaurants (тенант)
  name, slug (unique), domain, status (draft|published)
  logo, hero_photo (→ directus_files)
  primary_color, secondary_color
  languages (json-массив, напр. ["it","en"])
  phone, email, address, about_text
  hours (json — repeater: {day, open, close, closed})

menu_categories
  restaurant → restaurants   (on_delete: CASCADE)
  name (json, напр. {"it":"Antipasti","en":"Starters"})
  sort

menu_items
  restaurant → restaurants   (on_delete: CASCADE, прямой FK — не через category,
                               сделано специально для простоты прав)
  category → menu_categories (on_delete: SET NULL)
  name, description (json, мультиязычные)
  price (decimal 10,2)
  photo → directus_files
  vegan, vegetarian, gluten_free, available (boolean)
  sort

directus_users
  + кастомное поле restaurant → restaurants  (on_delete: SET NULL)
  — определяет, чей это логин-владелец
```

Мультиязычность решена как JSON-объект `{lang: text}` на самом поле, а
не через отдельные translation-коллекции — проще для такого объёма
контента, меньше джойнов.

## Роли и права

### Administrator
Встроенная, полный доступ. Один пользователь — владелец бизнеса
(`ivan.savilov@gmail.com`).

### Restaurant Owner
Role id `f95eb6ca-8682-4439-ae34-9a2ee4d723e2`, Policy id
`5eeb7839-979f-4b0a-b2fc-ef387453e41e`. `admin_access: false`,
`app_access: true`.

Права (все фильтры через `$CURRENT_USER.restaurant` — динамическая
переменная, резолвится в FK-значение поля `restaurant` у текущего
пользователя):

| Коллекция | create | read | update | delete |
|---|---|---|---|---|
| `restaurants` | — | только своя строка | только своя строка, **ограниченные поля** (без `slug`/`domain`/`status`) | — |
| `menu_categories` | да, `restaurant` подставляется автоматически (preset) | только свои | только свои | только свои |
| `menu_items` | да, аналогично | только свои | только свои | только свои |
| `directus_files` | да | да | да | — (не ограничено по арендатору, см. известное ограничение ниже) |
| `directus_users` | — | только свой профиль | только свой профиль, поля `password`/`first_name`/`last_name`/`avatar` | — |

Механизм защиты от подмены арендатора при create: `presets` подставляет
`restaurant: $CURRENT_USER.restaurant`, а `validation` **отдельно**
проверяет, что присланное значение совпадает — если владелец A явно
пришлёт `restaurant: <id ресторана B>` в теле запроса, Directus вернёт
`400 Validation failed`, а не тихо примет.

### Public (встроенная, id `abf8a154-5b1c-4a46-ac9c-7300570f4f17`)

Только чтение, только для `status: published`:

- `restaurants` — фильтр `status = published`
- `menu_categories` — фильтр `restaurant.status = published` (через связь)
- `menu_items` — фильтр `restaurant.status = published AND available = true`
- `directus_files` — чтение без ограничений

Это осознанное решение: меню ресторана — публичная информация, поэтому
Astro на этапе сборки читает данные **без токена** через публичный API.
Черновики (`status: draft`) через public API не видны.

## Проверка изоляции арендаторов

17.08.2026 прогнан автоматический тест-сьют (создавал два фейковых
ресторана A/B с логинами, проверял 9 сценариев: видимость в списке,
прямой доступ по ID, update/delete чужого, подмена `restaurant` при
create, доступ к чужой `restaurants`-строке, ограничение полей на
update). Все 9 — pass. Скрипт тестов не сохранён в репозитории (был
одноразовым в scratchpad сессии) — при существенных изменениях схемы
прав стоит написать заново и прогнать.

## Известные ограничения (не сделано, стоит учитывать)

- **Файлы (`directus_files`) не изолированы по арендатору.** Владелец A
  технически может прочитать файл, принадлежащий B, если узнает его
  file-ID (не может обнаружить его через список, но прямой доступ по
  ID не защищён). Для фото блюд/лого это низкий риск (не персональные
  данные), но не забывать при расширении на что-то чувствительное.
- Нет автоматического создания Cloudflare Pages проекта при создании
  ресторана вручную через Directus admin UI — это делает только скрипт
  `onboard-restaurant.py` (см. [client-onboarding.md](./client-onboarding.md)).
  Если завести ресторан руками через UI и сразу опубликовать, билд
  упадёт с "project not found", пока Pages-проект не создан отдельно.

## Directus Flows (автоматизация публикации)

Подробности механизма — [automation-pipeline.md](./automation-pipeline.md).
Список из 6 активных Flow: `Publish: restaurants create/update`,
`Publish: menu_categories create/update`, `Publish: menu_items create/
update`. Каждый триггерится `event` hook на своей коллекции и вызывает
`https://panel.veloce-network.xyz/webhook/build`.
