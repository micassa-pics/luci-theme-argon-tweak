# Installation assistant prompt

Copy the text below into your preferred LLM.

```text
Help me install Luci-argon-tweak using micassa/README.md. First ask me where I can find each item on MY network. Ask a small group of related questions at a time and wait for my answer. If I am unsure, show me a read-only LuCI screen or a narrow local command. Accept "skip" for optional features.

1. Where is my router, what OpenWrt, LuCI and Argon versions does it run, and how could I reach it if LuCI went offline?
2. Where in Network > Interfaces and Devices can I identify WAN, LAN, bridges, VLANs, secondary LANs, VPNs and guests? Which networks share a device and which carry a default route? Confirm any ambiguous roles with me.
3. What are your internet plan download and upload speeds? Ask separately and confirm Mbps versus Gbps (1 Gbps = 1000 Mbps). Ask whether these are advertised or measured. For LAN graphs, ask whether to use the local Ethernet link capacity, mirror the internet plan, or enter separate downstream and upstream limits. For a shared bridge, explain that received and sent include local traffic, then ask for RX and TX scales. Repeat back all four Mbps values and, after confirmation, use the four graph-scale options in the install guide. Leave omitted values on automatic.
4. Which device supplies DHCP and DNS on each LAN? Where can I find my Pi-hole address and verify local reverse DNS? Is there an existing DNS redirect rule and log prefix?
5. Where are my optional Bandix, nlbwmon, DDNS, Watchcat, banIP, SQM and collectd services? Which do I want? Which interfaces have RRD history? Which filesystems are mounted, including optional Docker storage?
6. Where can I keep a private backup and when can LuCI services be reloaded?

Then ask which DNS protections I want to install. Offer each independently, including the choice to keep my existing policy:

- DNS domain filtering with my existing Pi-hole and selected domain lists.
- Advertise the approved resolver by DHCP. For clients with hardcoded DNS, redirect both TCP and UDP port 53 or reject external DNS, according to my preference.
- Block external DNS over TLS on TCP 853 and DNS over QUIC on UDP 853.
- Install banIP and luci-app-banip if needed and enable an outbound IP feed for known DoH endpoints. Explain the coverage limits and shared-IP tradeoff. Use domain feeds in Pi-hole and IP feeds in banIP.
- Enable the DNS Redirects collector and rate-limited logging for intercepted IPv4 port 53 traffic.

For my choices, confirm the approved resolver, its upstream path, the selected client LANs/VLANs, IPv4/IPv6 use, and VPN or device exceptions. Check whether clients actually send the traffic through this router. Account for the return path to a resolver on the same LAN and preserve its ability to resolve upstream. Check installed packages, the OpenWrt release, firewall backend and available package manager before giving installation commands. Give only the steps for my selections, name the device where each step runs, and provide a rollback for each policy change separately from the overlay rollback.

After approval, guide installation one option at a time. From a client on each selected LAN, verify a normal lookup through the approved resolver and an explicit UDP and TCP lookup to a different resolver. For a redirect, correlate the timestamp, original destination and Pi-hole query log; a successful client lookup alone cannot identify the answering resolver. For a block, verify the matching rule counter increases. If I selected encrypted DNS blocking, test a known listed endpoint and ordinary HTTPS separately, with fallback disabled in the test client. Show where to find Firewall Summary and DNS Redirects and which results each page can verify.

Use placeholders for local addresses. Never ask me to paste passwords, tokens, keys, leases, full configuration or client lists. Summarize my topology and expected cards, explain changes and rollback, and ask before changing anything. End with checks for the features I selected.
```
