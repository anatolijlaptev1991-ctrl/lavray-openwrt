# SPDX-License-Identifier: GPL-3.0-only
#
# luci-app-lavray — страница LuCI «Сервисы → LAVRay»: статус, отпечаток
# сертификата панели, код первого входа, переключатель шлюза. Бэкенд —
# rpcd-плагин ucode (usr/share/rpcd/ucode/lavray) со своим ACL.
# Панель во фрейм не встраивается (ядро шлёт frame-ancestors 'none'),
# поэтому страница даёт ссылку в новой вкладке (спецификация §3.6).

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-lavray
PKG_VERSION:=0.9.1
PKG_RELEASE:=1
PKG_MAINTAINER:=LAVRay
PKG_LICENSE:=GPL-3.0-only
PKG_LICENSE_FILES:=LICENSE

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-lavray
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI status page for LAVRay gateway and web panel
  URL:=https://github.com/anatolijlaptev1991-ctrl/lavray
  DEPENDS:=+lavrayd +lavray-webui +luci-base +rpcd +curl
  PKGARCH:=all
endef

define Package/luci-app-lavray/description
  LuCI app: service status, certificate fingerprint (shown before first
  login), first-admin setup code, gateway toggle. Backend is an rpcd ucode
  plugin that talks to the core socket with curl --unix-socket (only root
  reads the core token). The embedded panel itself opens in a new tab.
endef

define Build/Compile
endef

define Package/luci-app-lavray/install
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./files/usr/share/luci/menu.d/luci-app-lavray.json \
		$(1)/usr/share/luci/menu.d/luci-app-lavray.json
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./files/usr/share/rpcd/acl.d/luci-app-lavray.json \
		$(1)/usr/share/rpcd/acl.d/luci-app-lavray.json
	$(INSTALL_DIR) $(1)/usr/share/rpcd/ucode
	$(INSTALL_DATA) ./files/usr/share/rpcd/ucode/lavray \
		$(1)/usr/share/rpcd/ucode/lavray
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/lavray
	$(INSTALL_DATA) ./files/www/luci-static/resources/view/lavray/status.js \
		$(1)/www/luci-static/resources/view/lavray/status.js
endef

$(eval $(call BuildPackage,luci-app-lavray))
