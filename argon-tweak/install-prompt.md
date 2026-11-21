# Installation assistant prompt

Copy the text below into your preferred LLM.

```text
Help me install luci-theme-argon-tweak v3.1.4.3. Start here in chat. Use the official release archive at https://api.github.com/repositories/1466932324/tarball/v3.1.4.3 and its argon-tweak/README.md installation reference. Assume Argon is the theme for this setup and its plugin layout audit. First ask me where I can find each item on MY network. Ask a small group of related questions at a time and wait for my answer. If I am unsure, show me a read-only LuCI screen or a narrow local command. Accept "skip" for optional features.

1. Where is my router, which OpenWrt, LuCI and Argon versions does it run, and how could I reach it if LuCI went offline?
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

After I approve the plan, use authorized router access if available to download and extract the release, run the bundled argon-tweak/install.sh helper from the extracted directory, and give me its rollback command. If you cannot access the router, guide me through those steps interactively. Refresh LuCI and verify the overlay, then configure my selected options one at a time. From a client on each selected LAN, verify a normal lookup through the approved resolver and an explicit UDP and TCP lookup to a different resolver. For a redirect, correlate the timestamp, original destination and Pi-hole query log; a successful client lookup alone cannot identify the answering resolver. For a block, verify the matching rule counter increases. If I selected encrypted DNS blocking, test a known listed endpoint and ordinary HTTPS separately, with fallback disabled in the test client. Show where to find Firewall Summary and DNS Redirects and which results each page can verify.

Use placeholders for local addresses. Never ask me to paste passwords, tokens, keys, leases, full configuration or client lists. Summarize my topology and expected cards, explain changes and rollback, and ask before changing anything.

After the main setup checks, ask “Would you like me to check your installed LuCI plugins for awkward text wrapping, hidden controls or clipped content?” Offer this whether or not I chose banIP. If I decline, continue setup.

If I accept, ask which devices and browsers I use. Review the installed plugin pages in Argon at those screen sizes. Open dropdowns and dialogs, check long labels and table headings, and verify that buttons stay readable and reachable. Where installed, check the banIP feed picker with the sidebar open and the Bandix device-row actions. Use sample data or redacted screenshots if needed. Report each issue with the page, control, screen size and steps to reproduce it. Identify any pages you could not inspect. Ask before applying fixes, then recheck the affected pages at the same widths.

As the final optional step, after the main installation and its checks are complete, ask this only if I chose banIP: “Would you also like the abuse.ch URLhaus malware feed?” Explain its purpose separately from the DoH endpoint list. If I decline, finish setup. If I say yes, walk me through these steps one at a time:

1. Have me open https://auth.abuse.ch/ in my own browser. I can sign in with a listed provider or enter my email and follow the sign-in link myself. Wait for me to confirm that I can see my profile.
2. Direct me to the Auth-Key in my abuse.ch profile. Have me obtain my own key using the portal if I do not already have one, then copy it locally. Ask only whether I found it. Keep my key, sign-in link and profile screenshots out of chat.
3. In my router's LuCI, guide me to Services → banIP → Feed Selection. Under Blocklist Feed, add urlhaus and preserve my existing feed selections. Have me paste my key directly into the masked Feed Auth-Key field on my router, then Save & Apply and reload banIP. If the feed or field is missing, check which banIP and LuCI app versions I have before continuing.
4. Ask me to check banIP's status or report for a successful urlhaus feed update. A successful reload alone does not verify the download. If authorization fails, have me recheck the key locally. Ask only for the status or error code; download URLs and raw logs may contain the key. Keep the key out of shared backups, images and Git.
```
