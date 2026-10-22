# feed/ — opkg-feed LAVRay

Структура подписного opkg-канала LAVRay, публикуемого на **GitHub Pages** и доступного
штатному `opkg` на роутере.

## Целевая структура

```
feed/
  Packages                    # индекс для архитектуры из имени файла (см. ниже)
  lavray-core_x86_64.ipk      # ядро-демон
  lavray-core_aarch64_generic.ipk
  lavray-web_x86_64.ipk       # веб-панель (static UI + раздача)
  lavray-web_aarch64_generic.ipk
  luci-app-lavray_all.ipk     # интеграция в LuCI
  geodata-*.ipk               # geoip/geosite-данные (версионированные)
  Packages.sig                # подпись индекса (см. UPDATE-SYSTEM)
```

В финальной версии индексы кладутся по архитектурам (`x86_64/Packages`, `aarch64_generic/Packages`),
в корне — общие (`all`) пакеты.

## Подключение на роутере (заготовка, Этап 3)

```sh
opkg update
opkg install feed-лоадер # или вручную:
echo "src/gz lavray https://<user>.github.io/lavray-openwrt/feed" >> /etc/opkg/customfeeds.conf
opkg update && opkg install lavray-core lavray-web luci-app-lavray
```

## Регламент

- Индекс `Packages` генерируется CI (`opkg-makeindex`), публикуется только из тега релиза.
- Каждый релиз подписывается; `opkg` проверяет подпись перед установкой
  (`lavray/docs/UPDATE-SYSTEM.md` — целостность обязательна, откат всегда возможен).
- Каналы `stable`/`beta` — отдельные каталоги фида (`feed/stable`, `feed/beta`).
- Ничего не публикуется вручную: фид — артефакт CI, а не рабочая копия.
