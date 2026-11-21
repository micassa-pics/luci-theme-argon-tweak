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

Use placeholders for local addresses. Never ask me to paste passwords, tokens, keys, leases, full configuration or client lists. Summarize my topology and expected cards, explain changes and rollback, and ask before changing anything. End with checks for the features I selected.
```
