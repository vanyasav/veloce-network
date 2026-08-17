# veloce-network — документация проекта

Бизнес: готовые сайты для ресторанов/пиццерий в Италии на базе Astro,
с самостоятельным редактированием контента владельцем через Directus CMS,
автодеплоем на Cloudflare Pages. Разворачивается на собственном VPS.

## Файлы

- [business-strategy.md](./business-strategy.md) — зачем и почему так: выбор
  стека, бизнес-модель, GTM
- [architecture.md](./architecture.md) — общая схема системы, как всё
  связано друг с другом
- [infrastructure.md](./infrastructure.md) — VPS, Docker, Caddy, домены,
  где что лежит и как к этому подключиться
- [directus-cms.md](./directus-cms.md) — схема данных, роли, права,
  изоляция арендаторов
- [astro-template.md](./astro-template.md) — структура сайта-шаблона,
  компоненты, адаптивность
- [automation-pipeline.md](./automation-pipeline.md) — как правка в CMS
  доезжает до живого сайта, грабли по пути
- [client-onboarding.md](./client-onboarding.md) — как завести нового
  клиента, пошагово
- [backups-and-recovery.md](./backups-and-recovery.md) — бэкапы и
  восстановление

## Быстрые ссылки

| Что | Где |
|---|---|
| Directus admin | https://panel.veloce-network.xyz/admin |
| VPS | `ssh vpnmain` (алиас в SSH-конфиге) |
| Демо-сайт 1 | https://demo-pizzeria.pages.dev |
| Демо-сайт 2 (тест онбординга) | https://trattoria-da-sofia.pages.dev |
| Astro-шаблон (исходники) | `~/Documents/websites/restaurant-template` на локальной машине |
| Ops-скрипты | `~/scripts/` на VPS |

## Текущий статус (на 17.08.2026)

Полностью рабочий пайплайн от правки в CMS до живого сайта, проверенный
end-to-end дважды (правка данных → автосборка → задеплоенный сайт).
Реальных платящих клиентов ещё нет — это внутренняя инфраструктура,
готовая к первому клиенту. Не хватает: кастомного домена для клиентов
(добавляется по мере появления), offsite-бэкапов, изоляции файлов по
арендатору (см. известные ограничения в directus-cms.md).
