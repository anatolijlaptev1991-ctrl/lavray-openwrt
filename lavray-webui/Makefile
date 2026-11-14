# SPDX-License-Identifier: GPL-3.0-only
#
# lavray-webui — метапакет: тянет lavrayd и при установке задаёт адрес
# панели из network.lan.ipaddr и включает TLS (спецификация §3, §5).
# Интерфейс уже встроен в бинарь lavray-core (тег with_webui), отдельных
# файлов в /www нет.

include $(TOPDIR)/rules.mk

PKG_NAME:=lavray-webui
# Метапакеты версионируются вместе с lavrayd: бамп гарантирует, что postinst
# переиграет при `opkg upgrade` и выставит enabled/start (аудит №6 P3-2,
# №7 P2-3).
PKG_VERSION:=0.9.3
PKG_RELEASE:=1
PKG_MAINTAINER:=LAVRay
PKG_LICENSE:=GPL-3.0-only
PKG_LICENSE_FILES:=LICENSE

include $(INCLUDE_DIR)/package.mk

define Package/lavray-webui
  SECTION:=net
  CATEGORY:=Network
  TITLE:=LAVRay web panel (metapackage: enables TLS, LAN address)
  URL:=https://github.com/anatolijlaptev1991-ctrl/lavray
  DEPENDS:=+lavrayd
  PKGARCH:=all
endef

define Package/lavray-webui/description
  Metapackage: depends on lavrayd (panel is embedded in its binary) and
  configures the panel for first use: listens on the router LAN address
  with TLS enabled. The setup code for the first admin is printed to
  /etc/lavray/data/web-setup-code by the core; see LuCI page or SSH.
endef

# При установке (и только пока стоят значения по умолчанию): подставить
# LAN-адрес, включить TLS и автозапуск. Значения пользователя (порт, адрес,
# выключенный сервис) при обновлении пакета не перетираются.
define Package/lavray-webui/postinst
[ "$$IPKG_INSTROOT" != "" ] && exit 0
lanip="$$(uci -q get network.lan.ipaddr)"
# Аудит №3 P2-3: при proto dhcp/relay ipaddr пуст — фактический адрес через ubus.
[ -n "$$lanip" ] || lanip="$$(ubus -S call network.interface.lan status 2>/dev/null | jsonfilter -e '@["ipv4-address"][0]' 2>/dev/null)"
cur="$$(uci -q get lavray.main.listen)"
if [ -n "$$lanip" ] && { [ -z "$$cur" ] || [ "$$cur" = "192.168.1.1:9090" ]; }; then
  uci set lavray.main.listen="$${lanip}:9090"
fi
if [ "$$(uci -q get lavray.main.tls)" != "0" ]; then
  uci set lavray.main.tls='1'
fi
# Аудит №4 P2-3: enabled задаётся только при ОТСУТСТВИИ опции (первая
# установка); явный '0'/'1' пользователя при upgrade сохраняется.
if [ -z "$$(uci -q get lavray.main.enabled)" ]; then
  uci set lavray.main.enabled='1'
fi
uci commit lavray
/etc/init.d/lavrayd enable >/dev/null 2>&1
# Аудит №7 P2-1: default_postinst запускает lavrayd раньше конца транзакции
# (когда enabled ещё не установлен) — стартуем здесь, после configure всех
# опций. Для явного enabled='0' start — no-op (страж в init).
/etc/init.d/lavrayd start >/dev/null 2>&1
echo "LAVRay: панель $$(uci -q get lavray.main.listen) (TLS), код первого входа: cat /etc/lavray/data/web-setup-code"
exit 0
endef

define Build/Compile
endef

define Package/lavray-webui/install
	$(INSTALL_DIR) $(1)/usr/share/lavray
	echo "lavray-webui: metapackage over lavrayd" > $(1)/usr/share/lavray/WEBUI
endef

$(eval $(call BuildPackage,lavray-webui))
