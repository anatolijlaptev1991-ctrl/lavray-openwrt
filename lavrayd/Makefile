# SPDX-License-Identifier: GPL-3.0-only
#
# lavrayd — пакет ядра LAVRay для OpenWrt: бинарь из релиза lavray плюс
# служба procd, UCI-конфиг, include для fw4 и страж правил.
# Спецификация: docs/OPENWRT-PACKAGING.md в репозитории lavray (§3, §4.1).
#
# Бинарь не собирается здесь: SDK только скачивает готовый lavray-core
# из релиза и упаковывает. Сборка ядра — репозиторий lavray (release-linux).
#
# Хэши ниже — из SHA256SUMS-linux.txt релиза v0.9.1. CI (release-packages.yml)
# подставляет хэши и версию того релиза, который упаковывает.

include $(TOPDIR)/rules.mk

PKG_NAME:=lavrayd
PKG_VERSION:=0.9.1
PKG_RELEASE:=1
PKG_MAINTAINER:=LAVRay
PKG_LICENSE:=GPL-3.0-only

ifeq ($(ARCH),x86_64)
  LAVRAY_GOARCH:=amd64
  # Якорь sed для CI — строка ПЕРЕД PKG_HASH: inline-комментарий оставлял бы
  # пробел в значении, и download.pl не распознавал бы SHA256.
  # amd64
  PKG_HASH:=145ad42a4f779a32096485b869bcbe2f51dcde62ff9fdee23195fd09a41ecc2d
else ifeq ($(ARCH),aarch64)
  LAVRAY_GOARCH:=arm64
  # arm64
  PKG_HASH:=17fc6bf6f7bd58a36a332a769defa727d132b20db61dc440f7c1dace0a0ff5d8
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
# 262144 кБ = 256 МиБ; MemTotal всегда чуть меньше номинала платы.
if [ -n "$$ram" ] && [ "$$ram" -lt 262144 ]; then
  echo "LAVRay: недостаточно ОЗУ ($$ram кБ): нужно не менее 256 МБ" >&2
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
[ "$$IPKG_INSTROOT" != "" ] && exit 0
/etc/init.d/lavrayd stop >/dev/null 2>&1
sed -i '\#usr/sbin/lavray-guard#d' /etc/crontabs/root 2>/dev/null
[ -f /etc/init.d/cron ] && /etc/init.d/cron restart >/dev/null 2>&1
exit 0
endef

$(eval $(call BuildPackage,lavrayd))
