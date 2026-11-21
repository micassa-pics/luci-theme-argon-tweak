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

### Firewall Summary

[View the Firewall Summary mockup with fictional rules and counters.](../docs/firewall-summary-mockup.png)

Open **Status → Firewall Summary** and select **Refresh** to read the active nftables rules. The page groups them under **DNS protection**, **Port forwards**, **Traffic rules**, **IP blocklists** and **System rules**. Search for a rule name, address or port. Expand a row to inspect the matches and action. **Hits** counts packets where counters are available. A dash means the count is unavailable. Custom DNS rules can appear under other headings, so use **Detailed rules** to check the active chain and **Firewall settings** to edit policy.

### DNS Redirects

[View the DNS Redirects mockup with fictional clients and grouped events.](../docs/dns-redirects-mockup.png)

Open **Status → DNS Redirects** to identify clients sending plain DNS to an unexpected resolver. **Devices** shows each client's latest activity and counts for local/private and other DNS destinations. The two event tables show time, device, client IP, original DNS server and TCP or UDP. Use **Group** to combine repeated attempts by client, destination and protocol. **Clear Entries** asks for confirmation and clears saved history as well.

The collector reads tagged IPv4 port 53 firewall events. It records the original destination; the matching firewall rule determines whether the packet was redirected or blocked. For queried domain names and Pi-hole's answer, consult the Pi-hole query log. Encrypted DNS blocks on other ports must be checked in the matching firewall or banIP counters. An empty event table can also mean the client used its assigned resolver, the traffic stayed on the same bridge, or logging was disabled.

To enable history, add a rate-limited log action with the exact prefix `MICASSA_DNS_REDIRECT: ` (including the trailing space) at the point where the original client and destination are still visible, before destination NAT. Apply rate limiting to the **log action only** so all matching packets still reach the enforcement rule. The collector keeps the latest 1,000 logged events and checkpoints every 30 minutes and on clean shutdown. Start it on the router:

```sh
/etc/init.d/dns-redirects enable
/etc/init.d/dns-redirects start
```

### Choosing DNS blocking options

| Goal | Installation choice |
| --- | --- |
| Filter domains for clients already using Pi-hole | Add the desired domain lists to Pi-hole and update Gravity. Advertise the approved resolver through the LAN's DHCP service. |
| Catch hardcoded plain DNS | Redirect client TCP **and** UDP port 53 to the approved resolver, or reject external port 53 if you prefer explicit failures. Exempt the resolver's own upstream traffic. For a same-LAN resolver, verify the reply returns through the router when using DNAT; source NAT may affect the client identity shown in Pi-hole. |
| Block the usual dedicated encrypted DNS ports | Offer outbound TCP 853 blocking for DNS over TLS and UDP 853 for DNS over QUIC. Preserve explicitly approved resolvers and VPN policies. |
| Block known DNS-over-HTTPS endpoints | Offer the OpenWrt banIP service and its LuCI app with an outbound DoH **IP** feed. Domain lists belong in a DNS filter. Endpoint lists have gaps, and blocking a shared IP can affect unrelated HTTPS sites. Keep ordinary web traffic on port 443 available. [banIP documentation](https://github.com/openwrt/packages/tree/master/net/banip) · [DoH feed formats](https://github.com/dibdot/DoH-IP-blocklists) |

Select the LANs and address families to cover. A routed guest LAN can have its own policy. Traffic exchanged directly by devices on a bridge can bypass the router firewall. The installation prompt walks through package selection, exceptions, testing and rollback for the chosen options.

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
