# Luci-argon-tweak

A fork of [Argon 3.1.4](https://github.com/jerrykuku/luci-theme-argon/releases/tag/v3.1.4) with an optional OpenWrt LuCI page overlay. Status Overview adds per-device traffic history, shared-bridge handling, active clients and mount-aware storage gauges. Also included are the customized Processes, Firewall Summary, DNS Redirects, nlbwmon, Bandix, Dynamic DNS, Watchcat and collectd pages, application permissions and touch dropdown placement for banIP.

![Mockup of the dark Status Overview with system readings, storage gauges and network history](docs/status-overview-mockup.png)

*Mockup with fictional devices, metrics and traffic.*

### Firewall Summary and DNS Redirects

Open **Status → Firewall Summary** to see which DNS rules, port forwards and blocklists are active. Search by port, address or rule name, then expand a rule to inspect its matches and action. **Status → DNS Redirects** answers a different question: which clients tried to use another DNS server? It shows the original destination, groups repeated attempts and keeps recent history across clean restarts. [Read the page guide and DNS policy options](micassa/README.md#firewall-summary)

![Firewall Summary mockup showing DNS protection rules, a port forward and packet counts](docs/firewall-summary-mockup.png)

![DNS Redirects mockup showing two fictional devices and repeated attempts grouped by destination](docs/dns-redirects-mockup.png)

[Install the overlay](micassa/README.md) | [Copy the installation assistant prompt](micassa/install-prompt.md) | [Upstream theme documentation](https://github.com/jerrykuku/luci-theme-argon/tree/v3.1.4)

See the upstream theme license and the [Bandix and Lucide notices](micassa/licenses/). LuCI notices remain with their files.
