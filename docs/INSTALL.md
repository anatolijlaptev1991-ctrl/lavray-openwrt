# Установка LAVRay на роутер OpenWrt

Платформы: OpenWrt 24.10 (opkg), архитектуры x86_64 и aarch64 (cortex-a53,
cortex-a72, generic). Минимум: 256 МБ ОЗУ, **100 МБ свободного места на
overlay** (бинарь ядра ~57 МБ + данные, логи и кэш LuCI; аудит №7 P2-4 —
ранее заявленные 64 МБ ставили ядро впритык, дальше ENOSPC). На mipsel_24kc
(MT7621, 128 МБ) LAVRay не работает — установщик откажется с объяснением.

> Инструкция верна для пакетов фида **0.9.3 и новее** (публикация тега
> v0.9.3). В фиде v0.9.1 служба при установке не стартует и зависимость
> `lavray-webui` отсутствует — обновите фид, как в §6.

## 1. Фид

Фид публикуется на GitHub Pages этого репозитория (репозиторий должен быть
публичным — Pages недоступны приватным; решение — за владельцем):

```
https://anatolijlaptev1991-ctrl.github.io/lavray-openwrt/<версия SDK>/<метка>/packages/
```

Каталог в URL — **патч-версия SDK публикации**, а не прошивки роутера
(сейчас `24.10.8`; аудит №7 P1-1). Например для x86_64:

`https://anatolijlaptev1991-ctrl.github.io/lavray-openwrt/24.10.8/x86_64/packages/`

Проверить доступные каталоги фида можно прямо в браузере — корень
`https://anatolijlaptev1991-ctrl.github.io/lavray-openwrt/` отдаёт список.

### Ключ фида

Индекс подписан usign. Открытый ключ — `feed/key.pub` в этом репозитории
(и в корне фида). На роутере:

```sh
wget -O /tmp/lavray-feed.pub https://anatolijlaptev1991-ctrl.github.io/lavray-openwrt/key.pub
opkg-key add /tmp/lavray-feed.pub
```

Строка фида (команда добавляет её в /etc/opkg/customfeeds.conf; аудит №7
P3-2 — вставка строки без команды в шелл не добавляет фид):

```sh
echo 'src/gz lavray https://anatolijlaptev1991-ctrl.github.io/lavray-openwrt/24.10.8/x86_64/packages' >> /etc/opkg/customfeeds.conf
```

Подпись фида обязательна (спецификация §4.2): обходные пути в инструкциях
не публикуются, фид без Packages.sig — как неофициальное зеркало и только
с ручной проверкой сумм пакетов (`ipkg-make-index`/`sha256sum`).

## 2. Установка

```sh
opkg update
opkg install luci-app-lavray   # тянет lavray-webui и lavrayd
```

Что делает установщик:

- создаёт пользователя `lavray` (на него ссылается nft-правило `meta skuid`);
- создаёт токен ядра `/etc/lavray/core.token` (0600, 36 байт энтропии);
- ставит службу procd `/etc/init.d/lavrayd` и включает автозапуск;
- ставит include fw4 `/usr/share/nftables.d/ruleset-post/lavray.nft`;
- ставит страж `/usr/sbin/lavray-guard` и строку cron раз в минуту;
- метапакет `lavray-webui` подставляет LAN-адрес роутера в адрес панели
  (`network.lan.ipaddr` или фактический адрес LAN через ubus — аудитор №3),
  включает TLS, разрешает автозапуск и **запускает службу** (аудит №7 P2-1:
  старт — в postinst метапакета, после configure всех опций транзакции).

## 3. Первый вход в панель

Ядро слушает не loopback, поэтому первый администратор создаётся только
с **кодом настройки**: пока админа нет, ядро пишет код в
`/etc/lavray/data/web-setup-code` (0600) и требует его в форме
«Создать первого администратора». Код читает тот, кто уже имеет доступ к
роутеру:

- LuCI: «Сервисы → LAVRay» → «Код первичной настройки» (rpcd читает файл
  от root и показывает только авторизованному администратору LuCI);
- SSH: `cat /etc/lavray/data/web-setup-code`.

Служба запускается автоматически при установке; если что-то помешало —
`/etc/init.d/lavrayd start` (аудитор №3 P2-4: код настройки пишется ядром
при первом запуске).

Код одноразовый: после создания администратора ядро удаляет файл. Затем
вход, серверы, подписки — как в приложении; шлюз (tproxy) и политики
per-MAC настраиваются в панели.

## 4. Пресет роутера

Для роутера собран персональный builtin-пресет **«LAV Preset OpenWrt»**
(`lav-openwrt`): адаптация LAV Preset RU для сценария «вся LAN через
роутер» — русские сайты, игровые домены, BigModel/DeepSeek/Kimi напрямую;
остальные AI/dev-сервисы и прочий трафик через прокси; реклама блокируется;
раздельный DNS. Отличие от LAV Preset RU: **без процессных правил
приложений** — на роутере трафик приходит от LAN-устройств, имя процесса
недоступно, такие правила не срабатывают.

> Требует ядра **0.9.4+**: пресет добавлен в лавray-core после релиза
> v0.9.3, в пакетах лавrayd 0.9.3 его ещё нет (аудит №6 P1-1). Пункт меню
> появится после обновления ядра и перепубликации фида.

Выбор: панель → Маршрутизация → Пресеты → «LAV Preset OpenWrt» → Активировать.
Затем в панели построить конфиг и запустить шлюз.

## 5. Включение шлюза

```sh
uci set lavray.main.enabled='1'
uci commit lavray
/etc/init.d/lavrayd restart
```

Правила `ip rule/route` для tproxy ставит init-скрипт при старте службы
(fwmark 1 → таблица 100), таблицу `inet lavray` — ядро, когда шлюз стал
Ready. После `fw4 reload` таблица возвращается через include. Если ядро
убито (kill -9, OOM), страж `lavray-guard` снимает правила за минуту —
интернет LAN идёт напрямую.

Для пакета lavrayd без webui:
`/etc/init.d/lavrayd enable` — автозапуск после reboot (аудитор №3 P3-6).

## 6. Обновление и откат

**Обновление.** Пакеты 0.9.3+ объявляют `/etc/config/lavray` conffile —
настройки сохраняются автоматически. При обновлении **с 0.9.1** conffiles
в старом пакете не было, поэтому UCI затирается дефолтом, а служба может
остаться выключенной (аудит №7 P2-3) — сохраните и восстановите вручную:

```sh
uci export lavray > /tmp/lavray.bak
opkg update
opkg upgrade lavrayd lavray-webui luci-app-lavray   # все три сразу
uci import lavray < /tmp/lavray.bak
/etc/init.d/lavrayd restart
```

Фид одноверсионный: `opkg update` видит только последнюю публикацию —
прошлые версии берите из tarball-ов релиза (ниже).

**Откат.** Tarball фида каждой версии прикреплён к release этого
репозитория (`lavray-feed-<SDK>-<метка>.tar.gz`) и переживает новые теги:

```sh
cd /tmp
wget https://github.com/anatolijlaptev1991-ctrl/lavray-openwrt/releases/download/v0.9.3/lavray-feed-24.10.8-x86_64.tar.gz
tar -xzf lavray-feed-24.10.8-x86_64.tar.gz
opkg --force-downgrade install ./lavrayd_*.ipk ./lavray-webui_*.ipk ./luci-app-lavray_*.ipk
```

## 7. Удаление

Удаляйте в порядке зависимостей — от зависимых к базовому:

```sh
opkg remove luci-app-lavray lavray-webui lavrayd
```

prerm lavrayd останавливает службу, снимает nft-таблицу, `ip rule/route`
и cron-строку стража — доступ к роутеру не теряется. Остаются (намеренно
и по механике opkg): изменённый `/etc/config/lavray` (opkg не удаляет
изменённые conffiles), `/etc/lavray/` (токен ядра, пользователи панели,
сертификат) и системный пользователь `lavray`. Полное вычищение:

```sh
rm -f /etc/config/lavray
rm -rf /etc/lavray
```

## 8. Проверка

- HTTPS: отпечаток сертификата в LuCI совпадает с тем, что покажет браузер.
- ТProxy для одного MAC: политика «через прокси» в панели → `nft list table
  inet lavray` → публичный IP этого устройства через сервер, остальных —
  напрямую.
- Падение ядра: `kill -9 $(pidof lavray-core)` — страж снимает правила
  не позже чем через минуту; `/etc/init.d/lavrayd restart` возвращает шлюз.

## 9. Ссылки

- Спецификация пакетов: `docs/OPENWRT-PACKAGING.md` в репозитории lavray.
- Шлюз: `docs/OPENWRT-GATEWAY.md`.
- Безопасность развёртывания: `docs/OPENWRT-PACKAGING.md` §5.
