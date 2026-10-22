# LAVRay для OpenWrt

Платформенный репозиторий LAVRay на OpenWrt: демон под procd, пакеты .ipk, веб-панель,
LuCI-приложение, opkg-feed и сборка в OpenWrt SDK. Общая кодовая база (Go-ядро, React UI)
живёт в [**lavray**](https://github.com/anatolijlaptev1991-ctrl/lavray) и подключается
сюда git-сабмодулем на зафиксированном коммите.

## Подключение общего репозитория

```bash
git submodule add https://github.com/anatolijlaptev1991-ctrl/lavray.git lavray
git submodule update --init --recursive
```

Обновление сабмодуля — отдельный PR: новый пин = новый коммит `lavray` (никогда не ветка).

## Зона ответственности этого репозитория

- **Служба procd:** демон `lavray-core` (запуск/стоп/перезапуск, respawn-политика,
  UCI-конфиг `/etc/config/lavray`), включение на boot.
- **Пакеты .ipk:** целевые архитектуры **x86_64** и **aarch64_generic**; зависимость от
  geodata-пакета; размер и зависимости контролируются в CI.
- **Веб-панель:** тот же React UI из `lavray/ui/` в режиме веб-панели — рендерится браузером,
  раздаётся демон-с/static на роутере (без Tauri-оболочки). Отличия от десктопа: нет
  клиентских процессных правил (silently опускаются с предупреждением), `geoip:private`
  обязателен (не заворачивать LAN).
- **luci-app-lavray:** заготовка в [`luci/`](luci/) — минимальная интеграция в LuCI
  (статус, старт/стоп, ссылка на полную веб-панель).
- **opkg-feed:** подписанный фид на GitHub Pages — структура в [`feed/`](feed/); пользователи
  ставят/обновляют LAVRay штатным `opkg` (см. `lavray/docs/UPDATE-SYSTEM.md`).
- **Сборка:** в контейнере **OpenWrt SDK** (воспроизводимо, без локальных тулчейнов).

## Статус

Этап 2 (дизайн, аудит) завершён в общем репозитории; платформенная реализация — Этап 3.
Здесь пока каркас: CI-заготовка, шаблоны issues, заготовки `feed/` и `luci/`.

## Ссылки

- Общий репозиторий: https://github.com/anatolijlaptev1991-ctrl/lavray
- Документация: `lavray/docs/` (REQUIREMENTS — разделы 15/18, PRESET-LAV-RU — OpenWrt-отличия,
  UPDATE-SYSTEM).
- Сестринские платформы: [lavray-windows](https://github.com/anatolijlaptev1991-ctrl/lavray-windows) ·
  [lavray-linux](https://github.com/anatolijlaptev1991-ctrl/lavray-linux) ·
  [lavray-macos](https://github.com/anatolijlaptev1991-ctrl/lavray-macos)

## Лицензия

[GPL-3.0](LICENSE), унаследована от LAVRay/nekoray.
