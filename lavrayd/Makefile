# SPDX-License-Identifier: GPL-3.0-only
#
# lavrayd — пакет ядра LAVRay для OpenWrt: бинарь из релиза lavray плюс
# служба procd, UCI-конфиг, include для fw4 и страж правил.
# Спецификация: docs/OPENWRT-PACKAGING.md в репозитории lavray (§3, §4.1).
#
# Бинарь не собирается здесь: SDK только скачивает готовый lavray-core
# из релиза и упаковывает. Сборка ядра — репозиторий lavray (release-linux).
#
# Версия и хеши обновляются вручную из SHA256SUMS-linux.txt соответствующего
# релиза lavray при его выходе (аудит №2 P2-2: автоматической подстановки
# CI нет; перед пушем сверять с gh release list).

include $(TOPDIR)/rules.mk

PKG_NAME:=lavrayd
PKG_VERSION:=0.9.3
PKG_RELEASE:=1
PKG_MAINTAINER:=LAVRay <262499256+anatolijlaptev1991-ctrl@users.noreply.github.com>
PKG_LICENSE:=GPL-3.0-only

ifeq ($(ARCH),x86_64)
  LAVRAY_GOARCH:=amd64
  # sha256(lavray-core-linux-amd64) из SHA256SUMS-linux.txt v0.9.3
  PKG_HASH:=7f1fbfba2838afe16a374217729a654f6928fcfac903aa3604d93a8eaf37bab2
else ifeq ($(ARCH),aarch64)
  LAVRAY_GOARCH:=arm64
  # sha256(lavray-core-linux-arm64) из SHA256SUMS-linux.txt v0.9.3
  PKG_HASH:=9ed825b71774732d67d1e930644a1a26378e3bdaba16de36f4d909187293dc9b
endif
# Неподдерживаемые архитектуры отклоняет preinst при установке (§4.4);
# $(error) здесь нельзя: метадата-скан фида выполняет make без целевой
# архитектуры и падал бы на этой ветке.

PKG_SOURCE:=lavray-core-linux-$(LAVRAY_GOARCH)
PKG_SOURCE_URL:=https://github.com/anatolijlaptev1991-ctrl/lavray/releases/download/v$(PKG_VERSION)
PKG_BUILD_DIR:=$(BUILD_DIR)/lavrayd-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/lavrayd
  SECTION:=net
  CATEGORY:=Network
  TITLE:=LAVRay core: proxy kernel with web panel and gateway (tproxy)
  URL:=https://github.com/anatolijlaptev1991-ctrl/lavray
  DEPENDS:=@(x86_64||aarch64) +kmod-tun +kmod-nft-tproxy +ca-bundle +firewall4
  # Пользователь ссылается в правиле `meta skuid` таблицы inet lavray:
  # имя должно существовать до применения правил. Форма name=id конфликтует
  # с фидом packages (377 занят apache — feeds install отказывал в установке
  # пакета), а name= (пустой id) отклоняется парсером metadata.pm — пакет
  # целиком выпадал из индекса фида. Голые имена: id выдаёт opkg при
  # установке, конфликтов не бывает.
  USERID:=lavray:lavray
endef

define Package/lavrayd/description
  LAVRay core daemon: sing-box proxy with embedded web panel, ConnectRPC
  API and OpenWrt tproxy gateway (per-MAC policies, watchdog, fw4 include).
  Panel address is taken from UCI (lavray.main.listen); TLS is on by
  default in lavray-webui. Supported: x86_64 and aarch64, 256 MiB RAM min.
endef

# Не supported-архитектуры: понятный отказ до распаковки (спецификация §4.4).
define Package/lavrayd/preinst
#!/bin/sh
[ "$$IPKG_INSTROOT" != "" ] && exit 0
arch=$$(uname -m)
case "$$arch" in
  x86_64|aarch64) ;;
  *)
    echo "LAVRay не поддерживает архитектуру $$arch: нужны x86_64 или aarch64 и не менее 256 МБ ОЗУ" >&2
    exit 1
    ;;
esac
ram=$$(awk '/^MemTotal:/{print $$2}' /proc/meminfo)
# Аудит №7 P3-3: у плат с номинальными 256 МБ MemTotal ≈ 246–250 МБ —
# порог 262144 кБ отсекал заявленный минимум. 230000 кБ ≈ 225 МиБ.
if [ -n "$$ram" ] && [ "$$ram" -lt 230000 ]; then
  echo "LAVRay: недостаточно ОЗУ ($$ram кБ): нужно не менее 256 МБ" >&2
  exit 1
fi
# Аудит №7 P2-4: бинарь ~57 МБ, плюс данные/логи/кэш LuCI — место на
# overlay обязано быть с запасом (максимум из / и /overlay покрывает extroot).
free=$$(df -k /overlay 2>/dev/null | awk 'NR==2{print $$4}')
free_root=$$(df -k / 2>/dev/null | awk 'NR==2{print $$4}')
for f in $$free $$free_root; do
  if [ -n "$$f" ] && [ "$$f" -gt "$${free:-0}" ]; then free=$$f; fi
done
if [ -n "$$free" ] && [ "$$free" -lt 92160 ]; then
  echo "LAVRay: мало места на overlay ($$free кБ свободно): нужно не менее 100 МБ" >&2
  exit 1
fi
exit 0
endef

define Build/Prepare
	$(CP) $(DL_DIR)/$(PKG_SOURCE) $(PKG_BUILD_DIR)/lavray-core
	chmod +x $(PKG_BUILD_DIR)/lavray-core
endef

# Бинарь готовый — собирать нечего.
define Build/Compile
endef

define Package/lavrayd/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/lavray-core $(1)/usr/bin/lavray-core
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/lavrayd.init $(1)/etc/init.d/lavrayd
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/lavray.config $(1)/etc/config/lavray
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./files/lavrayd-uci-defaults $(1)/etc/uci-defaults/90-lavrayd
	$(INSTALL_DIR) $(1)/usr/share/nftables.d/ruleset-post
	$(INSTALL_DATA) ./files/lavray.nft $(1)/usr/share/nftables.d/ruleset-post/lavray.nft
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) ./files/lavray-guard $(1)/usr/sbin/lavray-guard
	# /etc/lavray (токен ядра, пользователи панели, сертификат) переживает
	# sysupgrade: 24.10 читает только /lib/upgrade/keep.d (спецификация §5).
	$(INSTALL_DIR) $(1)/lib/upgrade/keep.d
	$(INSTALL_DATA) ./files/lavrayd.keep $(1)/lib/upgrade/keep.d/lavrayd
endef

# Останов при удалении: снять правила nft и строку cron. Данные
# /etc/lavray (настройки, пользователи панели, сертификат) не удаляются.
define Package/lavrayd/prerm
#!/bin/sh
[ "$$IPKG_INSTROOT" != "" ] && exit 0
/etc/init.d/lavrayd stop >/dev/null 2>&1
sed -i '\#usr/sbin/lavray-guard#d' /etc/crontabs/root 2>/dev/null
[ -f /etc/init.d/cron ] && /etc/init.d/cron restart >/dev/null 2>&1
exit 0
endef

# Аудит №2 P2-1: opkg upgrade сохраняет только объявленные conffiles —
# без объявления пользовательский UCI-конфиг затирался дефолтом, служба
# молча не стартовала (enabled=1 терялся, listen откатывался).
define Package/lavrayd/conffiles
/etc/config/lavray
endef

$(eval $(call BuildPackage,lavrayd))
