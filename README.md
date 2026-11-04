# LAVRay for OpenWrt

[![CI](https://github.com/anatolijlaptev1991-ctrl/lavray-openwrt/actions/workflows/ci.yml/badge.svg)](https://github.com/anatolijlaptev1991-ctrl/lavray-openwrt/actions/workflows/ci.yml)
![OpenWrt](https://img.shields.io/badge/OpenWrt-24.10-00B5E2?logo=openwrt)
![Arch](https://img.shields.io/badge/arch-x86__64%20%7C%20aarch64-lightgrey)

**LAVRay** — кроссплатформенный клиент прокси с раздельной маршрутизацией
(наследник NekoBox/NekoRay). Это **платформенный репозиторий для OpenWrt**:
пакеты `lavrayd` (ядро + procd-служба), `lavray-webui` (метапакет) и
`luci-app-lavray` (страница LuCI) в корне репозитория (раскладка фида
OpenWrt — каталоги пакетов на верхнем уровне), плюс opkg-фид, который
собирает CI через openwrt/gh-action-sdk. Общая кодовая база — **[lavray](https://github.com/anatolijlaptev1991-ctrl/lavray)**;
спецификация пакетов — [`docs/OPENWRT-PACKAGING.md`](https://github.com/anatolijlaptev1991-ctrl/lavray/blob/main/docs/OPENWRT-PACKAGING.md)
в том репозитории.

> Роутер работает как **шлюз**: заворачивает трафик подключённых устройств
> в туннель через nftables TProxy, с политиками per-MAC и стражем правил.

---

## Состав

| Пакет | Что это |
|---|---|
| `lavrayd` | Готовый бинарь `lavray-core` из релиза lavray (тег `with_webui`), procd-служба `/etc/init.d/lavrayd`, UCI `/etc/config/lavray`, include fw4 `/usr/share/nftables.d/ruleset-post/lavray.nft`, страж `/usr/sbin/lavray-guard` + cron, uci-defaults (токен ядра, LAN-адрес панели, cron) |
| `lavray-webui` | Метапакет: тянет `lavrayd`, при установке подставляет LAN-адрес в адрес панели, включает TLS, разрешает автозапуск. Панель встроена в бинарь — файлов в `/www` нет |
| `luci-app-lavray` | Страница «Сервисы → LAVRay»: статус, отпечаток сертификата, код первичной настройки, переключатель шлюза; бэкенд — rpcd-плагин ucode со своим ACL |

Поддерживаются OpenWrt 24.10 (opkg, `.ipk`), архитектуры `x86_64` и
`aarch64` (cortex-a53, cortex-a72, generic — один бинарь arm64 под тремя
метками). Минимум на устройстве: 256 МБ ОЗУ, 64 МБ overlay. На mipsel_24kc
(MT7621) не работает — `preinst` откажется с объяснением. Фид для 25.12+
(apk) появится отдельной итерацией (§4.3 спецификации, `[проверить]`).

---

## Установка

### 1. Фид (после первого релиза пакетов)

CI публикует фид на GitHub Pages этого репозитория (репозиторий должен
быть публичным — Pages недоступны приватным). Подробная инструкция с
ключом фида — [`docs/INSTALL.md`](docs/INSTALL.md):

```sh
src/gz lavray https://anatolijlaptev1991-ctrl.github.io/lavray-openwrt/<версия OpenWrt>/<метка>/packages
opkg update && opkg install luci-app-lavray
```

Индекс подписан usign: открытый ключ — `feed/key.pub` (генерируется
workflow `feed-key` вручную, секрет хранится в Environment `feed-signing`).

### 2. Вручную (.ipk из релиза)

```sh
opkg install lavrayd_<ver>_<arch>.ipk lavray-webui_<ver>_all.ipk luci-app-lavray_<ver>_all.ipk
```

---

## Настройка

UCI `/etc/config/lavray` (спецификация §3.2):

```
config lavray 'main'
	option enabled '0'
	option listen '192.168.1.1:9090'   # --web-bind; uci-defaults ставит network.lan.ipaddr
	option tls '1'                     # --web-tls
	option tproxy_port '7893'
	option ipv6 '0'
	option dns_hijack '0'
	option watchdog_min '5'
	option fwmark '1'
	option lan 'br-lan'
	option gomemlimit '96MiB'
	option gogc '50'
```

Панель: `https://<LAN-IP роутера>:9090/` — тот же UI, что в приложении.
Первый администратор создаётся с **кодом настройки**: пока админа нет,
ядро пишет его в `/etc/lavray/data/web-setup-code` (0600); код читают в
LuCI или по SSH. Политики per-MAC — в панели; LuCI показывает статус,
отпечаток сертификата (проверка до первого входа) и общий переключатель
шлюза.

---

## Архитектура на роутере

```
LAN-клиенты → fw4 (include lavray.nft → table inet lavray)
                ├─ TProxy tcp+udp → lavray-core (tproxy-инбаунд)
                ├─ DNS :53 → hijack (по настройке) → dns-remote/direct
                └─ исключения: приватные, DHCP, трафик самого ядра (skuid lavray)
lavrayd (procd, --platform openwrt) ── web-панель (TLS, код первого входа) ── LuCI (rpcd ucode)
страж lavray-guard (cron 1 мин + service_stopped): нет ядра → снять правила → интернет напрямую
```

Таблицу `inet lavray` ставит и снимает ядро (при Ready и при остановке);
include возвращает её после `fw4 reload`. Страж — на случай `kill -9`/OOM.

---

## Сборка

CI: workflow `release-packages` (тег `v*` или вручную) собирает пакеты
через `openwrt/gh-action-sdk` в официальных SDK-контейнерах
`openwrt/sdk:<цель>-24.10.8` для четырёх целей (x86_64, aarch64_cortex-a53,
aarch64_cortex-a72, aarch64_generic), строит индекс (`INDEX=1`) и подписывает
usign-ключом `KEY_BUILD` из Environment `feed-signing`, публикует в gh-pages
и релиз. Бинарь ядра скачивается из релиза `lavray` — из исходников в этом
репозитории ничего не компилируется.

Локально: `gh workflow run release-packages.yml`. Быстрые проверки без SDK
— `ci.yml` (sh -n, JSON, JS, структура пакетов, отсутствие секретов).

---

## Безопасность

- Панель слушает **один LAN-адрес** (не `0.0.0.0`), TLS включён метапакетом;
  отпечаток сертификата виден в LuCI до первого входа.
- Код первичной настройки защищает создание первого администратора.
- Токен ядра (`/etc/lavray/core.token`, 0600) даёт полный доступ к API —
  файл читает только root (rpcd); в ответы rpcd-плагина токен не попадает
  (проверка в CI).
- ACL LuCI: чтение статуса отдельно, переключение шлюза — отдельная
  привилегия (write).
- Служба работает от root на первой итерации (nft/tproxy требуют
  CAP_NET_ADMIN); усиление через ujail — §3.2 спецификации, `[проверить]`.

Политика: [SECURITY.md](https://github.com/anatolijlaptev1991-ctrl/lavray/blob/main/docs/SECURITY.md)
· Шлюз: [OPENWRT-GATEWAY.md](https://github.com/anatolijlaptev1991-ctrl/lavray/blob/main/docs/OPENWRT-GATEWAY.md)
· Спецификация: [OPENWRT-PACKAGING.md](https://github.com/anatolijlaptev1991-ctrl/lavray/blob/main/docs/OPENWRT-PACKAGING.md).

## Лицензия

[GPL-3.0](LICENSE) — производная nekoray и sing-box.
