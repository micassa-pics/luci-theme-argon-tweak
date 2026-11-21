#!/bin/sh
set -eu
cd "$(dirname "$0")"
stage=$(pwd)
test -f /www/luci-static/resources/ui.js && test -d /usr/share/luci/menu.d || { echo 'Run on a LuCI router.' >&2; exit 1; }
umask 077
backup=$(mktemp -d /root/argon-tweak-rollback.XXXXXX)
mkdir "$backup/before"
: > "$backup/added"
cat > "$backup/rollback.sh" <<'ROLLBACK'
#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ -f new-collector ] && [ -x /etc/init.d/dns-redirects ]; then
	/etc/init.d/dns-redirects stop || :
	/etc/init.d/dns-redirects disable || :
fi
while IFS= read -r path; do rm -f "/$path"; done < added
cp -a before/. /
rm -f /tmp/luci-indexcache
/etc/init.d/rpcd reload
ROLLBACK
chmod 700 "$backup/rollback.sh"
printf 'Rollback: sh %s/rollback.sh\n' "$backup"
put() {
	src=$1
	dst=$2
	mode=$3
	parent=$(dirname "/$dst")
	(umask 022; mkdir -p "$parent")
	if [ -e "/$dst" ] || [ -L "/$dst" ]; then
		mkdir -p "$backup/before/$(dirname "$dst")"
		cp -a "/$dst" "$backup/before/$dst"
	else
		printf '%s\n' "$dst" >> "$backup/added"
	fi
	tmp=$(mktemp "/$dst.argon-tweak.XXXXXX")
	cat "$src" > "$tmp" && chmod "$mode" "$tmp" && mv -f "$tmp" "/$dst" || { rm -f "$tmp"; return 1; }
}
[ -e /etc/init.d/dns-redirects ] || touch "$backup/new-collector"
(cd files && find . -type f | sort) > "$backup/manifest"
while IFS= read -r entry; do
	path=${entry#./}
	case "$path" in
	*/luci-app-dns-redirects.json) ;;
	*/menu.d/luci-app-*|*/acl.d/luci-app-*) [ -f "/$path" ] || continue;;
	esac
	case "$path" in etc/init.d/*|usr/libexec/*) mode=755;; *) mode=644;; esac
	put "files/$path" "$path" "$mode"
done < "$backup/manifest"
css=www/luci-static/argon/css/cascade.css
if [ -f "/$css" ]; then
	if ucode touch.uc "$stage" "$backup/ui.js"; then
		[ ! -s "$backup/ui.js" ] || put "$backup/ui.js" www/luci-static/resources/ui.js 644
		if ! grep -Fq 'Wrap long touch-menu choices' "/$css"; then
			cat "/$css" argon-touch-dropdown.css > "$backup/cascade.css"
			put "$backup/cascade.css" "$css" 644
		fi
	else
		echo 'Skipped touch placement: LuCI dropdown source differs.' >&2
	fi
fi
rm -f /tmp/luci-indexcache
/etc/init.d/rpcd reload
