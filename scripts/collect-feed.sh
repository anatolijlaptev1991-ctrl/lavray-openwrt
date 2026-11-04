#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-only
#
# collect-feed.sh — собрать фид opkg из собранных SDK-пакетов
# (спецификация OPENWRT-PACKAGING.md §4.2):
#   <out>/<openwrt-version>/<label>/packages/{*.ipk, Packages, Packages.gz[, Packages.sig]}
#
# Использование (внутри каталога распакованного SDK):
#   sh collect-feed.sh <openwrt-version> <label> <out-root> [feed.sec]
#
# Важно: индекс строится В КАТАЛОГЕ ФИДА только по нашим ipk
# (scripts/ipkg-make-index.sh), а не копируется из bin/packages/<arch> —
# там же лежат зависимости (kmod-tun, curl, ...), попавшие в bin при сборке;
# их включать нельзя: на роутере они должны браться из официального фида.
#
# Подпись — usign-ключом фида (Environment feed-signing). Без ключа фид
# выходит без Packages.sig — предупреждение, как у релизов 0.9.x без
# подписанных метаданных обновлений до церемонии ключей.
set -eu

ver="$1"; label="$2"; out="$3"; key="${4:-}"

if [ ! -d bin/packages ]; then
	echo "FAIL: bin/packages пуст — пакеты не собраны?" >&2
	exit 1
fi

dest="$out/$ver/$label/packages"
mkdir -p "$dest"

# Копируем только наши ipk из всех каталогов архитектур SDK.
found=0
for arch_dir in bin/packages/*; do
	[ -d "$arch_dir" ] || continue
	for f in "$arch_dir"/lavray*_*.ipk "$arch_dir"/luci-app-lavray_*.ipk; do
		[ -f "$f" ] || continue
		case "$(basename "$f")" in
			lavray*|luci-app-lavray*) cp "$f" "$dest/" ;;
			*) echo "FAIL: чужой пакет в bin: $f" >&2; exit 1 ;;
		esac
		found=1
	done
done
[ "$found" = 1 ] || { echo "FAIL: lavray*-пакетов нет в bin/packages" >&2; exit 1; }

# Индекс в каталоге фида — только по нашим ipk (SDK-ный make package/index
# строит по всему bin/packages и при CONFIG_SIGNED_PACKAGES=y требует
# key-build; CI выключает подпись SDK — подписываем фид отдельно).
# ipkg-make-index.sh: pkg_dir=$1, записи в stdout, прогресс в stderr,
# требует $MKHASH (host-инструмент SDK). Filename должен быть относительным
# (./name.ipk), поэтому cd в каталог фида.
index_sh="scripts/ipkg-make-index.sh"
[ -f "$index_sh" ] || { echo "FAIL: нет $index_sh в SDK" >&2; exit 1; }
mkhash="staging_dir/host/bin/mkhash"
[ -f "$mkhash" ] || { echo "FAIL: нет $mkhash — host-инструменты не собраны" >&2; exit 1; }

(
	cd "$dest"
	MKHASH="$OLDPWD/$mkhash" bash "$OLDPWD/$index_sh" . > Packages
	gzip -kf Packages
)

if [ -n "$key" ]; then
	usign -S -m "$dest/Packages" -s "$key" -x "$dest/Packages.sig" -c "LAVRay feed $ver/$label"
	echo "PASS: Packages.sig подписан ($ver/$label)"
else
	echo "WARN: ключ фида не задан — Packages без Packages.sig (см. §4.2)" >&2
fi

echo "PASS: $dest -> $(ls "$dest" | tr '\n' ' ')"
