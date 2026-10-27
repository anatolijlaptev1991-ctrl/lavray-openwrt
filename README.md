# LAVRay for OpenWrt

[![CI](https://github.com/anatolijlaptev1991-ctrl/lavray-openwrt/actions/workflows/ci.yml/badge.svg)](https://github.com/anatolijlaptev1991-ctrl/lavray-openwrt/actions/workflows/ci.yml)
![OpenWrt](https://img.shields.io/badge/OpenWrt-24.10%20%7C%2025.12-00B5E2?logo=openwrt)
![Arch](https://img.shields.io/badge/arch-x86__64%20%7C%20aarch64__generic-lightgrey)

**LAVRay** — кроссплатформенный клиент прокси с раздельной маршрутизацией
(наследник NekoBox/NekoRay). Это **платформенный репозиторий для OpenWrt**:
демон `lavrayd` под procd, веб-панель, LuCI-приложение, пакеты и opkg-feed.

> Роутер работает как **шлюз**: заворачивает трафик подключённых устройств в
> туннель через nftables TProxy, с политиками per-MAC. Общая кодовая база —
> **[lavray](https://github.com/anatolijlaptev1991-ctrl/lavray)**.

---

## Состав пакетов

| Пакет | Что это |
|---|---|
| `lavrayd` | Go-ядро + демон (procd, `respawn 3600 5 0`), UCI `/etc/config/lavray` |
| `lavray-webui` | Единый React UI в режиме веб-панели: вход по паролю, HTTPS |
| `luci-app-lavray` | LuCI-приложение: статус, пресеты, политики устройств, логи |
| `lavray-feed` | opkg/apk фид с подписью (usign/apk) и watchdog-откатом |

---

## Установка

### 1. Фид (рекомендуется)

```sh
# 24.10 (opkg)
wget -O /etc/opkg/keys/<keyid> https://github.com/anatolijlaptev1991-ctrl/lavray-openwrt/raw/main/feed/keys/lavray.pub
echo "src/gz lavray https://github.com/anatolijlaptev1991-ctrl/lavray-openwrt/raw/main/feed/ipk" >> /etc/opkg/customfeeds.conf
opkg update && opkg install luci-app-lavray

# 25.12+ (apk)
wget -O /etc/apk/keys/lavray.pub https://github.com/anatolijlaptev1991-ctrl/lavray-openwrt/raw/main/feed/keys/lavray.pub
echo "https://github.com/anatolijlaptev1991-ctrl/lavray-openwrt/raw/main/feed/apk/packages.adb" >> /etc/apk/repositories
apk update && apk add luci-app-lavray
```

### 2. Вручную (.ipk)

```sh
opkg install lavrayd_<ver>_<arch>.ipk lavray-webui_<ver>_all.ipk luci-app-lavray_<ver>_all.ipk
/etc/init.d/lavray enable && /etc/init.d/lavray start
```

Архитектуры: `x86_64`, `aarch64_generic` (минимум 256 МБ RAM / 64 МБ overlay).

---

## Настройка

UCI: `/etc/config/lavray`

```
config lavray 'main'
    option enabled '1'
    option mode 'tproxy'          # tproxy | tun | off
    option web_bind '0.0.0.0:8443'
    option web_allow_remote '1'   # панель доступна из LAN (пароль обязателен)
    option tproxy_port '7893'
    option ipv6 '0'               # отдельная ip6-цепочка, по умолчанию выкл
    option preset 'lav-ru'
    option watchdog_min '5'       # нет связи N минут → снять правила
```

Веб-панель: `https://<router>:8443` — экран входа, затем тот же UI, что в
десктоп-приложении (5 разделов). LuCI: «Сервисы → LAVRay».

### Политики устройств (per-MAC)

| Политика | Поведение |
|---|---|
| `proxy` | всё устройство через туннель |
| `direct` | напрямую (гостевая сеть по умолчанию) |
| `preset` | по правилам выбранного пресета |

---

## Архитектура на роутере

```
LAN-клиенты → fw4 (include lavray.nft, table inet lavray)
                ├─ TProxy tcp+udp → lavray-core (tproxy-инбаунд)
                ├─ DNS :53 → hijack-dns → dns-remote/direct
                └─ исключения: приватные, DHCP, трафик самого lavrayd (skuid)
lavrayd (procd) ── web-панель (Cookie+CSRF) ── LuCI (ubus)
watchdog: нет связи N мин → снять правила → интернет напрямую; восстановление → вернуть
```

Правила генерируются детерминированно (`internal/gateway/nft.go`) и снимаются
стражем восстановления при старте (FR-UI-270) — осиротевших правил не бывает.

---

## Сборка

```bash
# SDK-контейнер (пример x86_64)
docker run --rm -v "$PWD:/work" -w /work \
  ghcr.io/openwrt/sdk:x86_64-24.10 \
  sh -c './build.sh'
```

Артефакты: `lavrayd_*.ipk`, `lavray-webui_*.ipk`, `luci-app-lavray_*.ipk`,
индекс фида `Packages(.gz)`. Матрица CI: 2 архитектуры × 2 релиза (24.10 ipk,
25.12 apk). Smoke: установка в QEMU-образ, старт сервиса, проверка `/healthz`.

## Безопасность

- Подпись фида обязательна; `signed-by`/keys в `/etc/opkg/keys`.
- Веб-панель: пароль (PBKDF2), cookie HttpOnly/SameSite=Strict, CSRF, backoff.
- TUN/TProxy — только свои правила; чужой трафик не перехватывается.
- Откат обновления — watchdog (UPDATE-SYSTEM §6).

Политика: [SECURITY.md](https://github.com/anatolijlaptev1991-ctrl/lavray/blob/main/docs/SECURITY.md)
· Шлюз: [OPENWRT-GATEWAY.md](https://github.com/anatolijlaptev1991-ctrl/lavray/blob/main/docs/OPENWRT-GATEWAY.md).

## Лицензия

[GPL-3.0](LICENSE) — производная nekoray и sing-box.
