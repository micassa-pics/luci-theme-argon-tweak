/* Overview polling and section controls adapted from OpenWrt LuCI.
 * Copyright 2008 Steven Barth <steven@midlink.org>
 * Copyright 2008-2022 Jo-Philipp Wich <jo@mein.io>
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';
'require view';
'require dom';
'require poll';
'require fs';
'require network';
'require rpc';
'require uci';

const systemInfo = rpc.declare({ object: 'system', method: 'info', reject: true });
const portConnectionCounts = rpc.declare({ object: 'luci.port_connections', method: 'counts', reject: true });
const history = rpc.declare({ object: 'luci.port_connections', method: 'history', params: ['interface'], reject: true });
const activeClients = rpc.declare({ object: 'luci.port_connections', method: 'active_clients', params: ['interface'], reject: true });
const dhcpStatus = rpc.declare({ object: 'luci.port_connections', method: 'dhcp_status', reject: true });
const systemBoard = rpc.declare({ object: 'system', method: 'board', reject: true });
const luciVersion = rpc.declare({ object: 'luci', method: 'getVersion', reject: true });
const routerTime = rpc.declare({ object: 'luci', method: 'getUnixtime', expect: { result: 0 }, reject: true });
const mountPoints = rpc.declare({ object: 'luci', method: 'getMountPoints', expect: { result: [] }, reject: true });
const deviceStatus = rpc.declare({ object: 'network.device', method: 'status', params: ['name'], reject: true });
const ddnsStatus = rpc.declare({ object: 'luci.ddns', method: 'get_services_status', expect: {} });

const style = `
.overview-pair, .overview-status-pair {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--overview-column-min, 15rem)), 1fr));
  gap: clamp(.4rem, 1.4vw, .9rem);
}
.overview-ports { grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); }
.port-count { grid-column: 1 / -1; font-size: .85rem; }
.wan-history { grid-column: 1 / -1; min-width: 0; } .wan-history > svg { display: block; width: 100%; height: 100px; background: repeating-linear-gradient(to top, rgba(148,163,184,.14) 0 1px, transparent 1px 25%); } .wan-history path { fill: none; stroke-width: 1.5; stroke-linejoin: round; } .wan-down { --line: #06b6d4; } .wan-up { --line: #f97316; } .wan-history path { stroke: var(--line); } .wan-history path.wan-up { stroke-dasharray: 4 3; }
.wan-legend { display: flex; justify-content: flex-end; text-align: right; flex-wrap: wrap; gap: .25rem .7rem; font-size: .85em; } .wan-legend span::before { content: ""; display: inline-block; width: 1em; margin-right: .3em; vertical-align: middle; border-top: 2px solid var(--line); } .wan-legend .wan-up::before { border-top-style: dashed; }
.wan-legend svg { width: 1.1em; height: 1.1em; vertical-align: -.18em; }
.wan-legend svg path { stroke-width: 2; stroke-linecap: round; }
@media (max-width: 1000px) { .overview-status-pair:has(.overview-ports) { grid-template-columns: 1fr; } }
.overview-panel { min-width: 0; padding: clamp(.6rem, 1.4vw, 1rem); border: 1px solid var(--border-color, #8885); border-radius: .6rem; }
.overview-panel h4 { margin: 0 0 .55rem; font-size: 1rem; }
.overview-resources { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 7rem), 1fr)); gap: .9rem clamp(.8rem, 2vw, 1.5rem); align-content: start; padding-bottom: 1rem; }
.overview-resource-main { min-width: 0; display: grid; justify-items: center; align-content: start; gap: .3rem; }
.overview-resource-main h5 { margin: 0; font-size: .8rem; text-align: center; overflow-wrap: anywhere; }
.overview-resource-values { width: fit-content; max-width: 100%; font-size: .75rem; line-height: 1.35; }
.overview-resource-values .overview-readings { grid-template-columns: auto auto; gap: .1rem .4rem; }
.overview-donut { --overview-ring: var(--primary, #5286df); --overview-empty: var(--border-color, #8886); display: grid; place-items: center;
  position: relative; flex: none; width: clamp(3.25rem, 9vw, 6rem); aspect-ratio: 1; font-weight: 650; font-variant-numeric: tabular-nums; }
.overview-donut::before { content: ''; position: absolute; inset: 0; border-radius: 50%;
  background: conic-gradient(var(--overview-ring) 0 var(--overview-used, 0%), var(--overview-empty) 0);
  mask: radial-gradient(farthest-side, transparent 70%, #000 72%); }
.overview-partition[data-mount="/tmp"] .overview-donut { --overview-ring: #e6a54a; --overview-empty: rgba(230, 165, 74, .26); }
.overview-donut-label { position: relative; }
.overview-readings { min-width: 0; margin: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .2rem .55rem; }
.overview-readings dt, .overview-readings dd { margin: 0; overflow-wrap: anywhere; }
.overview-readings dd { text-align: end; font-variant-numeric: tabular-nums; }
.overview-system .overview-readings { grid-template-columns: fit-content(50%) minmax(0, 1fr); column-gap: .3rem; }
.overview-system .overview-readings dt { text-align: end; }
.overview-system .overview-readings dt::after { content: ':'; }
.overview-system .overview-readings dd { text-align: start; }
.overview-detail { border-top: 1px solid var(--border-color, #8885); margin-top: .7rem; padding-top: .55rem; font-size: .9em; }
.overview-port { display: grid; grid-template-columns: clamp(1.2rem, 2.6vw, 2.65rem) minmax(0, 1fr);
  align-items: center; gap: .4rem clamp(.28rem, .9vw, .72rem); }
.overview-port img { display: block; width: 100%; }
.overview-port-details { display: grid; gap: 0; text-align: left; justify-items: start; }
.overview-port-details h4 small { font-size: .78em; font-weight: normal; overflow-wrap: anywhere; }
.overview-port > .overview-port-details > * { margin: 0; padding: 0; line-height: 1.12; }
.overview-port-details > span { font-size: clamp(.75rem, 1.4vw, .9rem); white-space: nowrap; }
.overview-port-details .overview-readings { justify-self: stretch; margin-top: .2rem; grid-template-columns: auto minmax(0, 1fr); gap: .1rem .3rem; font-size: .75rem; }
.overview-port-details .overview-readings dt { text-align: left; }
.overview-port-details .overview-readings dd { text-align: right; }
.overview-status-pair { --overview-column-min: 16rem; align-items: stretch; margin-bottom: 1rem; }
.overview-status-pair > .cbi-section { min-width: 0; margin: 0; }
.overview-ports > .overview-port { align-content: start; }
.overview-network .network-status-table { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr)); gap: .45rem; }
.overview-network .network-status-table .ifacebox { min-width: 0; width: 100%; margin: 0; }
.overview-network .network-status-table .ifacebox-body { height: auto; padding: .5rem .6rem; overflow-wrap: anywhere; }
.overview-network .ifacebox-body > div:has(> .ifacebadge) { display: none; }
.overview-network .ifacebox-body > span {
  display: grid; grid-template-columns: fit-content(50%) minmax(0, 1fr);
  gap: .15rem .3rem; text-align: left;
}
.overview-network .ifacebox-body > span > .nowrap { display: contents; white-space: normal; }
.overview-network .ifacebox-body > span > br { display: none; }
.overview-network .nowrap > strong,
.overview-network .table td:first-child { text-align: right; }
.overview-network .table td + td { text-align: left; }
.overview-network .table td:first-child { width: 1%; white-space: nowrap; padding-right: .3rem; }
.overview-network .table td + td { padding-left: 0; }
.overview-network .cbi-title + div > .table { margin: .45rem 0 0; }
.overview-ddns-host { white-space: normal; overflow-wrap: anywhere; }
@media (max-width: 1120px) {
  .overview-readings { grid-template-columns: minmax(0, auto) minmax(0, 1fr); }
  .overview-port { padding-inline: .45rem; }
}
@media (max-width: 660px) {
  .overview-donut { width: clamp(3.5rem, 13vw, 4.5rem); font-size: .9em; }
}
`;

function bytes(value) {
	return Number.isFinite(value) ? '%1024.2mB'.format(value) : '—';
}

function readings(rows, extraClass = '') {
	return E('dl', { class: 'overview-readings ' + extraClass },
		rows.flatMap(([label, value]) => [E('dt', {}, label), E('dd', {}, value)]));
}

function formatRouterTime(timestamp) {
	if (!Number.isFinite(timestamp) || timestamp <= 0) return '—';
	const settings = uci.get('system', '@system[0]') ?? {};
	const timeZone = settings.zonename?.replaceAll(' ', '_') || 'UTC';
	const options = {
		dateStyle: 'medium',
		timeStyle: settings.clock_timestyle && settings.clock_timestyle !== '0' ? 'full' : 'long',
		hourCycle: ['h11', 'h12', 'h23', 'h24'].includes(settings.clock_hourcycle) ? settings.clock_hourcycle : undefined,
		timeZone
	};
	const date = new Date(timestamp * 1000);
	try {
		const formatter = new Intl.DateTimeFormat(undefined, options);
		return formatter.format(date);
	} catch {
		return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'long', timeZone: 'UTC' }).format(date);
	}
}

const systemSummary = {
	title: _('System'),
	load: () => Promise.all([
		L.resolveDefault(systemBoard(), {}), L.resolveDefault(systemInfo(), {}),
		L.resolveDefault(luciVersion(), {}), L.resolveDefault(routerTime(), 0),
		L.resolveDefault(uci.load('system'), null)
	]),
	render([board, info, luci, timestamp]) {
		const unknown = '—';
		const version = [luci.branch, luci.revision].filter(Boolean).join(' ');
		const loadRows = [_('1-minute load avg'), _('5-minute load avg'), _('15-minute load avg')].map((label, i) => {
			const value = info.load?.[i];
			return [label, Number.isFinite(value) ? (value / 65536).toFixed(2) : unknown];
		});
		return E('div', { class: 'overview-pair overview-system' }, [
			E('section', { class: 'overview-panel', 'aria-label': _('Device') },
				readings([
					[_('Hostname'), board.hostname || unknown], [_('Model'), board.model || unknown],
					[_('Architecture'), board.system || unknown], [_('Target Platform'), board.release?.target || unknown],
					[_('Local Time'), formatRouterTime(timestamp)],
					[_('Uptime'), Number.isFinite(info.uptime) ? '%t'.format(info.uptime) : unknown]
				])
			),
			E('section', { class: 'overview-panel', 'aria-label': _('Software and runtime') },
				readings([
					[_('Firmware Version'), board.release?.description || unknown], [_('LuCI Version'), version || unknown],
					[_('Kernel Version'), board.kernel || unknown],

					...loadRows
				])
			)
		]);
	}
};

function resourceContent(title, used, total, freeLabel, extras = []) {
	const valid = Number.isFinite(total) && total > 0 && Number.isFinite(used);
	const usedBytes = valid ? Math.min(total, Math.max(0, used)) : null;
	const usedPercent = valid ? usedBytes * 100 / total : 0;
	const percent = usedPercent > 0 && usedPercent < 1
		? (usedPercent < .1 ? '<0.1' : usedPercent.toFixed(1)) : String(Math.round(usedPercent));
	const gauge = E('div', {
		class: 'overview-donut', style: '--overview-used:' + usedPercent + '%',
		role: 'img', 'aria-label': valid ? _('%s: %s%% used').format(title, percent) : _('%s: usage unavailable').format(title)
	}, E('span', { class: 'overview-donut-label', 'aria-hidden': 'true' }, valid ? percent + '%' : '—'));

	const values = E('div', { class: 'overview-resource-values' }, readings([
		[_('Used'), bytes(usedBytes)], [freeLabel, bytes(valid ? total - usedBytes : null)], [_('Total'), bytes(total)]
	]));
	if (extras.length) values.appendChild(readings(extras, 'overview-detail'));
	return E('div', { class: 'overview-resource-main' }, [gauge, E('h5', {}, title), values]);
}

function storagePartitions(root, mounts) {
	const rootMount = mounts.find(entry => entry.mount === '/');
	const overlay = rootMount && !rootMount.device?.startsWith('/dev/')
		? mounts.find(entry => entry.mount === '/overlay') : null;
	const partitions = [{
		path: '/', title: _('Root (/)'),
		used: root.total > 0 ? root.used * 1024 : rootMount?.size - rootMount?.free,
		total: root.total > 0 ? root.total * 1024 : rootMount?.size
	}];
	const devices = new Set([rootMount?.device, overlay?.device]);
	for (const { device, mount, size, free } of mounts) {
		if (!device?.startsWith('/dev/') || !mount || mount === '/' || !(size > 0) || devices.has(device))
			continue;
		devices.add(device);
		partitions.push({ path: mount, title: mount === '/boot' ? _('Boot (/boot)') : mount, used: size - free, total: size });
	}
	return partitions.filter(partition => partition.total > 0);
}

function partitionReading({path, title, used, total}) {
	return E('div', { class: 'overview-partition', 'data-mount': path }, [
		resourceContent(title, used, total, _('Free'))
	]);
}

function ramDiskReading(tmp, mounts) {
	const tmpMount = mounts.find(entry => entry.mount === '/tmp' && entry.device === 'tmpfs');
	const tmpTotal = tmp.total > 0 ? tmp.total * 1024 : tmpMount?.size;
	if (!(tmpTotal > 0)) return null;
	return partitionReading({ path: '/tmp', title: _('RAM disk (/tmp)'),
		used: tmp.total > 0 ? tmp.used * 1024 : tmpMount.size - tmpMount.free, total: tmpTotal });
}

const portStates = new Map();

function portRates({ name, status, role }, state) {
	const capacity = Number(String(status?.speed ?? '').match(/^(\d+)[FH]?$/)?.[1]);
	const rx = status?.statistics?.rx_bytes, tx = status?.statistics?.tx_bytes;
	const time = performance.now();
	const previous = state.previous;
	const active = status?.up !== false && Number.isFinite(rx) && Number.isFinite(tx);
	state.previous = active ? { name, capacity, rx, tx, time } : null;
	const elapsed = time - previous?.time;
	if (!active || previous?.name !== name || 
	    !(elapsed > 0 && elapsed < 60000) || rx < previous.rx || tx < previous.tx)
		return { capacity: active ? capacity : null };
	return directions(role, (rx - previous.rx) * 0.008 / elapsed, (tx - previous.tx) * 0.008 / elapsed);
}

function directions(role, received, sent) {
	return role === 'lan' ? { down: sent, up: received } : { down: received, up: sent };
}

let routerClockOffset = 0;
async function seedPortHistory(role, name, iface) {
	if (portStates.has(name) && portStates.get(name).role === role) return;
	const state = { name, role, samples: new Map() };
	portStates.set(name, state);
	const [archive, clock] = await Promise.all([
		L.resolveDefault(history(iface), null),
		L.resolveDefault(routerTime(), null)
	]);
	if (Number.isFinite(clock)) routerClockOffset = clock - Date.now() / 1000;
	for (const line of (archive?.stdout || '').split('\n')) {
		const match = line.trim().match(/^(\d+):\s+(\S+)\s+(\S+)$/);
		if (!match) continue;
		const down = Number(match[2]) * 8e-6, up = Number(match[3]) * 8e-6;
		if (Number.isFinite(down) && Number.isFinite(up)) state.samples.set(+match[1], directions(role, down, up));
	}
}

function portChart(link) {
	const state = portStates.get(link.name), samplesByTime = state.samples;
	const now = Date.now() / 1000 + routerClockOffset, start = now - 600;
	const rates = portRates(link, state);
	if (Number.isFinite(rates.down)) samplesByTime.set(now, rates);
	for (const t of samplesByTime.keys()) if (t < start) samplesByTime.delete(t);
	const samples = [...samplesByTime].filter(([t]) => t <= now).sort((a, b) => a[0] - b[0]);
	const configured = key => {
		const value = Number(uci.get('argon-tweak', 'status', key));
		return Number.isFinite(value) && value > 0 ? value : null;
	};
	const speed = parseFloat(link.status?.speed);
	const fallback = Number.isFinite(speed) && speed > 0 ? speed : 1000;
	const prefix = link.role === 'wan' ? 'wan' : 'lan';
	const scales = {
		down: configured(prefix + '_down_mbps') || fallback,
		up: configured(prefix + '_up_mbps') || fallback
	};
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', '0 0 600 100');
	svg.setAttribute('preserveAspectRatio', 'none');
	svg.setAttribute('role', 'img');
	svg.setAttribute('aria-label', link.label + ' · ' + _('Last 10 minutes'));
	const labels = [];
	for (const [key, title] of [['down', link.role === 'shared' ? _('Received') : _('Download')], ['up', link.role === 'shared' ? _('Sent') : _('Upload')]]) {
		const path = document.createElementNS(svg.namespaceURI, 'path');
		path.setAttribute('d', samples.map(([t, v], i) =>
			(i && t - samples[i - 1][0] <= 60 ? 'L' : 'M') + (t - start).toFixed(2) + ' ' + (99 - 98 * Math.min(1, Math.max(0, v[key] / scales[key]))).toFixed(2)
		).join(' '));
		const area = document.createElementNS(svg.namespaceURI, 'path');
		const segments = (path.getAttribute('d') || '').split('M').filter(Boolean);
		area.setAttribute('d', segments.map(segment => {
			const points = segment.split('L');
			const firstX = points[0].split(' ')[0], lastX = points[points.length - 1].split(' ')[0];
			return 'M' + segment + 'L' + lastX + ' 100L' + firstX + ' 100Z';
		}).join(' '));
		area.setAttribute('class', 'wan-' + key);
		area.style.cssText = 'stroke:none; fill:var(--line); fill-opacity:.1';
		svg.insertBefore(area, svg.firstChild);
		path.setAttribute('class', 'wan-' + key);
		path.setAttribute('vector-effect', 'non-scaling-stroke');
		svg.appendChild(path);
		// Lucide arrow-down and arrow-up (ISC).
		const arrow = document.createElementNS(svg.namespaceURI, 'svg');
		arrow.setAttribute('viewBox', '0 0 24 24');
		arrow.setAttribute('role', 'img');
		arrow.setAttribute('aria-label', title);
		const arrowPath = document.createElementNS(svg.namespaceURI, 'path');
		arrowPath.setAttribute('d', key === 'down' ? 'M12 5v14m7-7-7 7-7-7' : 'M12 19V5m-7 7 7-7 7 7');
		arrow.appendChild(arrowPath);
		const rateText = Number.isFinite(rates[key]) ? rates[key].toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' Mbps' : '—';
		labels.push(E('span', { class: 'wan-' + key, title: title + ' · ' + scales[key] + ' Mbps full scale', 'aria-label': title + ' ' + rateText + ', ' + scales[key] + ' Mbps full scale' }, [link.role === 'shared' ? title + ' ' : '', rateText + ' ', arrow]));
	}

	return E('div', { class: 'wan-history' }, [svg, E('div', { class: 'wan-legend' }, labels)]);
}

function loadResourceData() {
	return Promise.all([L.resolveDefault(systemInfo(), {}), L.resolveDefault(mountPoints(), [])]);
}

const memorySection = {
	title: _('Memory'),
	load: loadResourceData,
	render([info, mounts]) {
		const mem = info.memory ?? {}, swap = info.swap ?? {}, tmp = info.tmp ?? {};
		const available = mem.available ?? (Number.isFinite(mem.free) ? mem.free + (mem.buffered ?? 0) + (mem.cached ?? 0) : null);
		const memoryDetails = [];
		if (swap.total > 0) memoryDetails.push([_('Swap used'), bytes(swap.total - swap.free) + ' / ' + bytes(swap.total)]);

		const memory = E('div', { class: 'overview-resources' }, [
			resourceContent(_('Memory'), Number.isFinite(available) ? mem.total - available : null, mem.total, _('Available'), memoryDetails)
		]);
		const ramDisk = ramDiskReading(tmp, mounts);
		if (ramDisk) memory.appendChild(ramDisk);
		return memory;
	}
};

const storageSection = {
	title: _('Storage'),
	load: loadResourceData,
	render([info, mounts]) {
		return E('div', { class: 'overview-resources' }, storagePartitions(info.root ?? {}, mounts || []).map(partitionReading));
	}
};

let downstreamDhcpRequest;
let downstreamDhcpRefresh = 0;
function loadDownstreamDhcp() {
	if (!downstreamDhcpRequest || Date.now() >= downstreamDhcpRefresh) {
		downstreamDhcpRefresh = Date.now() + 60_000;
		downstreamDhcpRequest = L.resolveDefault(dhcpStatus(), {});
	}
	return downstreamDhcpRequest;
}

function downstreamCard(lan, clients, dhcp) {
	const rows = [
		_('Protocol'), dhcp?.pihole ? _('Pi-hole DHCP') : (lan?.getI18n() || '—'),
		_('Address'), (lan?.getIPAddrs() || []).join(', ') || '—',
		_('Active clients'), E('span', { title: _('Unique LAN devices confirmed by the router in the last 5 minutes') }, Number.isInteger(clients?.count) ? String(clients.count) : '—'),
		_('DNS'), (lan?.getDNSAddrs() || []).join(', ') || '—'
	];
	if (dhcp?.pihole && dhcp.leaseTime)
		rows.push(_('Lease time'), E('span', { title: _('Configured IPv4 lease duration in Pi-hole') }, dhcp.leaseTime));
	const up = lan?.isUp();
	if (up) rows.push(_('Connected'), '%t'.format(lan.getUptime()));
	else rows.push(_('Status'), lan ? _('Disconnected') : _('Unavailable'));
	return E('div', { class: 'ifacebox' }, [
		E('div', { class: 'ifacebox-head center' + (up ? ' active' : '') }, E('strong', {}, lan.getName().toUpperCase())),
		E('div', { class: 'ifacebox-body left' }, L.itemlist(E('span'), rows))
	]);
}

function layoutNetworkCards(content, downstream) {
	const cards = content?.querySelector('.network-status-table');
	if (!cards) return;

	const wanCards = Array.from(cards.children);
	for (const card of wanCards) {
		const heading = card.querySelector('.ifacebox-head strong');
		if (heading)
			heading.textContent = wanCards.length > 1 && heading.textContent === _('IPv6 Upstream') ? _('WAN (IPv6)') : _('WAN');
	}
	for (const {net, clients, dhcp} of downstream) cards.appendChild(downstreamCard(net, clients, dhcp));
}

function renderPort({role, name, label, status}) {
	const carrier = status?.carrier == null ? !!status?.up : !!status.carrier;
	const link = status ? (carrier ? _('Connected') : _('Disconnected')) : _('Unavailable');
	const rawSpeed = carrier ? String(status.speed ?? '').match(/^(\d+)([FH])?$/) : null;
	const rate = Number(rawSpeed?.[1]) || 0;
	const speed = rate >= 1000 ? _('%s Gbps').format((rate / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 }))
		: rate > 0 ? _('%d Mbps').format(rate) : '';
	const duplex = rawSpeed?.[2] === 'F' ? _('Full duplex') : rawSpeed?.[2] === 'H' ? _('Half duplex') : '';
	const stats = status?.statistics ?? {};
	const details = [
		E('h4', {}, name ? [label + ' ', E('small', {}, name)] : role.toUpperCase()),
		E('span', { class: 'overview-link' }, E('strong', {}, link))
	];
	if (speed) details.push(E('span', { class: 'overview-port-speed' }, speed));
	if (duplex) details.push(E('span', { class: 'overview-port-duplex' }, duplex));
	return E('section', { class: 'overview-panel overview-port', 'data-role': role, 'data-device': name || '' }, [
		E('img', { src: L.resource('icons/port_' + (carrier ? 'up' : 'down') + '.svg'), alt: '' }),
		E('div', { class: 'overview-port-details' }, [
			...details, readings([[_('Received'), bytes(stats.rx_bytes)], [_('Sent'), bytes(stats.tx_bytes)]])
		])
	]);
}

async function discoverPorts() {
	const [nets, upstream, upstream6] = await Promise.all([
		network.getNetworks(), network.getWANNetworks(), network.getWAN6Networks(),
		L.resolveDefault(uci.load('firewall'), null), L.resolveDefault(uci.load('argon-tweak'), null)
	]);
	const routed = new Set([...upstream, ...upstream6].map(net => net.getName()));
	const wanZone = new Set();
	for (const zone of uci.sections('firewall', 'zone')) {
		if (zone.name !== 'wan') continue;
		for (const iface of [].concat(zone.network || []).flatMap(value => value.split(/\\s+/))) wanZone.add(iface);
	}
	const roles = key => new Set([].concat(uci.get('argon-tweak', 'status', key) || []).flatMap(v => v.split(/\s+/)));
	const local = roles('downstream'), upstreamRoles = roles('upstream'), hidden = roles('ignore');
	const groups = new Map();
	for (const net of nets) {
		const iface = net.getName();
		const name = (net.getL3Device() || net.getDevice())?.getName();
		if (!name || hidden.has(iface) || name === 'lo' || iface === 'loopback') continue;
		const isDown = local.has(iface) || (!upstreamRoles.has(iface) && (!(wanZone.has(iface) || /^wan[0-9]*$/.test(iface) || routed.has(iface)) ||
			iface === 'lan' || (nets.length <= 2 && !wanZone.has(iface) && !/^wan[0-9]*$/.test(iface))));
		const isUp = upstreamRoles.has(iface) || (!local.has(iface) && (routed.has(iface) || wanZone.has(iface) || /^wan[0-9]*$/.test(iface)));
		const group = groups.get(name) || {name, nets: [], lan: false, wan: false};
		group.nets.push({net, downstream: isDown});
		group.lan ||= isDown;
		group.wan ||= isUp;
		groups.set(name, group);
	}
	return [...groups.values()].map(group => {
		const role = group.wan && group.lan ? 'shared' : group.wan ? 'wan' : 'lan';
		const label = role === 'shared' ? _('WAN / LAN (shared)') :
			group.nets.map(entry => entry.net.getName().toUpperCase()).join(' / ');
		return {...group, role, label};
	}).sort((a,b) => Number(b.wan) - Number(a.wan) || a.name.localeCompare(b.name));
}

const ports = {
	title: _('Port status'),
	async load() {
		const [groups, totals] = await Promise.all([discoverPorts(), L.resolveDefault(portConnectionCounts(), null)]);
		for (const name of portStates.keys()) if (!groups.some(group => group.name === name)) portStates.delete(name);
		return Promise.all(groups.map(async group => {
			const {name, role} = group;
			await seedPortHistory(role, name, group.nets[0].net.getName());
			return {...group, count: totals ? totals[name] ?? 0 : null, status: await L.resolveDefault(deviceStatus(name), null)};
		}));
	},
	render: links => E('div', { class: 'overview-pair overview-ports' }, links.map(link =>
		{
			const card = renderPort(link);
			card.appendChild(portChart(link));
			card.appendChild(E('div', { class: 'port-count', title: _('Tracked IPv4 connections using this port, inferred from routes') },
				readings([[_('Active Connections'), Number.isFinite(link.count) ? link.count.toLocaleString() : '—']])));
			return card;
		}))
};

function ddnsHostname(domain, lookup) {
	return E('div', { class: 'overview-ddns-host' }, E('strong', {}, domain || lookup || '—'));
}

const ddns = {
	title: _('Dynamic DNS'),
	load: () => Promise.all([ddnsStatus(), uci.load('ddns')]),
	render([services]) {
		const headers = [_('Configuration'), _('Next Update'), _('Hostname'), _('Registered IP'), _('Network')];
		const table = E('table', { class: 'table' }, E('tr', { class: 'tr table-titles' },
			headers.map(label => E('th', { class: 'th', scope: 'col' }, label))));
		const rows = Object.entries(services ?? {}).map(([key, status]) => [
			key,
			status.next_update ? _(status.next_update) : _('Unknown'),
			ddnsHostname(uci.get('ddns', key, 'domain'), uci.get('ddns', key, 'lookup_host')),
			status.ip || _('No Data'),
			(uci.get('ddns', key, 'use_ipv6') === '1' ? 'IPv6' : 'IPv4') + ' / ' + (uci.get('ddns', key, 'interface') || '—')
		]);
		cbi_update_table(table, rows, E('em', {}, _('There is no service configured.')));
		return table;
	}
};

function dhcpEnabled(sections) {
	const odhcpdV4 = sections.some(section => section['.type'] === 'odhcpd' && section.maindhcp === '1');
	return sections.some(section => section['.type'] === 'dhcp' && (
		(odhcpdV4 ? section.dhcpv4 === 'server' : section.ignore !== '1') ||
		section.dhcpv6 === 'server' || section.dhcpv6 === 'hybrid'
	));
}

function wirelessEnabled(sections) {
	const radios = new Set(sections
		.filter(section => section['.type'] === 'wifi-device' && section.disabled !== '1')
		.map(section => section['.name']));
	return sections.some(section => section['.type'] === 'wifi-iface' &&
		section.disabled !== '1' && radios.has(section.device));
}

async function configAllowsSection(config, isEnabled) {
	try {
		await uci.load(config);
		return isEnabled(uci.sections(config));
	} catch {
		return true;
	}
}

return view.extend({
	async load() {
		const [entries, showDhcp, showWireless] = await Promise.all([
			L.resolveDefault(fs.list('/www' + L.resource('view/status/include')), []),
			configAllowsSection('dhcp', dhcpEnabled),
			configAllowsSection('wireless', wirelessEnabled)
		]);
		const replaced = new Set(['10_system.js', '20_memory.js', '25_storage.js', '29_ports.js']);
		if (!showDhcp) replaced.add('40_dhcp.js');
		if (!showWireless) replaced.add('60_wifi.js');
		const remaining = entries.filter(entry => entry.type === 'file' && /\.js$/.test(entry.name) &&
			!replaced.has(entry.name))
			.map(entry => [entry.name, entry.name === '70_ddns.js' ? ddns :
				L.require('view.status.include.' + entry.name.replace(/\.js$/, ''))]);
		remaining.push(['10_system.js', systemSummary], ['20_memory.js', memorySection], ['25_storage.js', storageSection], ['29_ports.js', ports]);
		remaining.sort(([a], [b]) => a.localeCompare(b));
		return Promise.all(remaining.map(async ([filename, include]) => ({ filename, include: await include })));
	},

	async render(includes) {
		const view = E([E('style', {}, style)]);
		const statusPair = E('div', { class: 'overview-status-pair' });
		const resourcePair = E('div', { class: 'overview-status-pair' });
		const sectionPairs = new Map([
			['20_memory.js', resourcePair], ['25_storage.js', resourcePair],
			['29_ports.js', statusPair], ['30_network.js', statusPair]
		]);
		const sections = includes.map(({ filename, include }) => {
			const title = include.title ?? String(include).replace(/^\[ViewStatusInclude\d+_(.+)Class\]$/,
				(_, name) => name.replace(/(^|_)(.)/g, (_match, separator, letter) => (separator ? ' ' : '') + letter.toUpperCase()));
			let hidden = localStorage.getItem(title) === 'hide';
			const container = E('div', { style: hidden ? 'display:none' : null });
			const toggle = E('span', { 'data-indicator': 'poll-status', 'data-clickable': 'true',
				style: 'display:flex;align-items:center;justify-content:center;min-width:4em', click: () => {
					hidden = !hidden;
					if (hidden) localStorage.setItem(title, 'hide');
					else {
						localStorage.removeItem(title);
						dom.content(container, E('p', {}, E('em', { class: 'spinning' }, _('Collecting data…'))));
					}
					updateToggle();
				} });
			function updateToggle() {
				toggle.className = hidden ? 'label notice' : 'label';
				toggle.dataset.style = hidden ? 'active' : 'inactive';
				toggle.textContent = hidden ? _('Show') : _('Hide');
				container.style.display = hidden ? 'none' : '';
			}
			updateToggle();
			const pair = sectionPairs.get(filename);
			const section = E('div', { class: 'cbi-section' + (filename === '30_network.js' ? ' overview-network' : ''), style: 'display:none' }, [
				E('div', { class: 'cbi-title' }, E('h3', { style: 'display:flex;justify-content:space-between' }, [title, toggle])),
				container
			]);
			if (pair) {
				if (!pair.parentNode) view.appendChild(pair);
				pair.appendChild(section);
			} else {
				view.appendChild(section);
			}
			return { filename, include, section, container, hidden: () => hidden };
		});
		async function update(first) {
			await network.flushCache();
			await Promise.all(sections.map(async ({ filename, include, section, container, hidden }) => {
				if (hidden() && !first) return;
				try {
					const data = await include.load?.();
					const content = include.render ? include.render(data) : include.content;
					if (filename === '30_network.js') {
						const groups = await discoverPorts();
						const downstream = await Promise.all(groups.flatMap(group => group.nets.filter(entry => entry.downstream)).map(async ({net}) => ({
							net, clients: await L.resolveDefault(activeClients(net.getName()), null),
							dhcp: net.getName() === 'lan' ? await loadDownstreamDhcp() : {}
						})));
						layoutNetworkCards(content, downstream);
						const table = content?.querySelector('table.table');
						table?.remove();
					}
					if (include.oneshot) {
						include.oneshot(data);
						include.oneshot = null;
					}
					if (content != null) {
						section.style.display = '';
						section.classList.add('fade-in');
						if (!hidden()) dom.content(container, content);
					}
				} catch (error) {
					console.error(error);
				}
			}));
			const legacy = document.querySelector('div.includes');
			if (legacy) {
				legacy.style.display = '';
				legacy.classList.add('fade-in');
			}
		}
		await update(true);
		poll.add(() => update(false));
		return view;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
