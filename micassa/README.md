# Page overlay installation

Start with the [copyable installation assistant prompt](install-prompt.md). This overlay targets OpenWrt 25.12 LuCI and Argon 3.1.4. Install the desired LuCI applications first. On the router, from an extracted copy of this branch, run:

```sh
sh micassa/install.sh
```

The script backs up replaced files, skips menu and permission overrides for absent optional apps, reloads rpcd and prints a rollback command. Save the backup privately. Refresh LuCI and sign in again. Roll back before upgrading LuCI and review compatibility afterward.

**Network.** The overview groups logical networks by runtime device. Shared bridges report RX/TX once. Neighbor counts are per device, so two networks on one bridge share a count. Offloaded traffic can bypass host counters. The charts use interface-octet RRD history where available and collect live samples while open.

**Names and DHCP.** Use a router resolver that can answer client PTR queries. To enable the optional Pi-hole DHCP badge, substitute its local IPv4 address below. The badge needs an accessible unauthenticated DHCP-status endpoint and a gateway matching the primary LAN.

```sh
touch /etc/config/micassa
uci set micassa.status=status
uci set micassa.status.pihole_ipv4='YOUR_PIHOLE_LAN_IPV4'
uci commit micassa
```

**DNS redirect history.** Configure the matching part of your existing IPv4 TCP/UDP port 53 policy to log with the prefix `MICASSA_DNS_REDIRECT: ` including the trailing space. The collector checkpoints every 30 minutes and on clean shutdown. To enable it:

```sh
/etc/init.d/dns-redirects enable
/etc/init.d/dns-redirects start
```

**Touch menus.** If the installed LuCI dropdown implementation differs, the installer skips the JavaScript patch and reports it.

For custom roles, use UCI list options on the local `micassa.status` section. Add logical interface names to `downstream`, `upstream`, or `ignore`. Listing an interface in both roles marks it shared. These options affect display only. For example, after creating the section above:

```sh
uci add_list micassa.status.downstream='guest'
uci commit micassa
```

### Traffic chart scales

Set each direction in Mbps. WAN download corresponds to RX and upload to TX. LAN download corresponds to TX toward clients and upload to RX from clients. A shared bridge uses the LAN scales for RX and TX respectively. Each line has its own full-scale value, shown in its legend tooltip. These display settings do not shape traffic. With no configured value, each direction uses the reported link speed, falling back to 1000 Mbps when unavailable.

Example for a 500/50 Mbps internet plan and symmetric gigabit LAN:

~~~sh
touch /etc/config/micassa
uci set micassa.status=status
uci set micassa.status.wan_down_mbps='500'
uci set micassa.status.wan_up_mbps='50'
uci set micassa.status.lan_down_mbps='1000'
uci set micassa.status.lan_up_mbps='1000'
uci commit micassa
~~~

Refresh Status Overview after changing these values.
