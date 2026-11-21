'use strict';
'require view';
'require dom';
'require poll';
'require rpc';
'require ui';

const getHistory = rpc.declare({ object: 'luci.dns_redirects', method: 'history', reject: true });
const getHostname = rpc.declare({ object: 'luci.dns_redirects', method: 'hostname', params: [ 'ip' ] });
const getHostHints = rpc.declare({ object: 'luci-rpc', method: 'getHostHints' });
const clearHistory = rpc.declare({ object: 'luci.dns_redirects', method: 'clear', reject: true });
const headingStyle = 'display: flex; align-items: center; justify-content: space-between; gap: 1em';
const tableStyle = `
.dns-redirect-scroll { max-width: 100%; overflow-x: auto; }
.dns-redirect-scroll table.table { display: table; width: 100%; min-width: 43rem; table-layout: fixed; }
.dns-redirect-scroll .table tr { display: table-row; }
.dns-redirect-scroll .table tr > :is(th, td) { display: table-cell; box-sizing: border-box; text-align: start; white-space: normal; overflow-wrap: anywhere; }
.dns-redirect-scroll .table tr > :first-child:not([colspan]) { text-align: left !important; }
.dns-redirect-scroll .table td:first-child > span { display: block; text-align: left; }
.dns-redirect-scroll .table tr > :last-child:not([colspan]) { text-align: end; font-variant-numeric: tabular-nums; }
`;

function makeTable(columns) {
	const widths = ['22%', '16%', '19%', '12%', '19%', '12%'];
	return E('table', { 'class': 'table' }, [ E('tr', { 'class': 'tr table-titles' },
		columns.map((column, i) => E('th', { 'class': 'th', 'scope': 'col', style: 'width:' + widths[i] }, column))) ]);
}

function formatTime(time) {
	return new Date(time * 1000).toLocaleString();
}

function isLocalDestination(ip) {
	const [ first, second ] = ip.split('.').map(Number);
	return first === 10 || first === 127 || (first === 169 && second === 254) ||
		(first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

function redirectSection(title, names) {
	const columns = [ _('Device'), _('Client IP'), _('Original DNS server'), _('Protocol') ];
	const individual = makeTable([ ...columns, _('Time'), _('Redirects') ]);
	const grouped = makeTable([ ...columns, _('Last seen'), _('Redirects') ]);
	const individualBody = E('div', { class: 'dns-redirect-scroll' }, [ individual ]);
	const groupedBody = E('div', { class: 'dns-redirect-scroll' }, [ grouped ]);
	groupedBody.hidden = true;
	let entries = [];

	function update(rows) {
		entries = rows;
		const table = groupedBody.hidden ? individual : grouped;
		const rowsToDisplay = [];
		const groups = new Map();
		for (const [ time, client, server, protocol ] of rows) {
			const key = [ client, server, protocol ].join(' ');
			if (table === grouped && groups.has(key)) {
				groups.get(key)[5]++;
				continue;
			}
			const row = [ E('span', {}, names.get(client) || client), client, server, protocol, formatTime(time), 1 ];
			if (table === grouped) {
				groups.set(key, row);
			}
			rowsToDisplay.push(row);
		}
		cbi_update_table(table, rowsToDisplay, E('em', {}, _('No redirects recorded yet.')));
	}

	const button = E('button', {
		type: 'button', class: 'btn cbi-button',
		'title': _('Group repeated redirects by device, DNS server and protocol'),
		click: event => {
			const showGroups = groupedBody.hidden;
			groupedBody.hidden = !showGroups;
			individualBody.hidden = showGroups;
			event.currentTarget.textContent = showGroups ? _('Ungroup') : _('Group');
			update(entries);
		}
	}, _('Group'));
	update(entries);
	return {
		update,
		node: E('section', {}, [
			E('div', { style: headingStyle }, [ E('h3', {}, title), button ]),
			individualBody, groupedBody
		])
	};
}

function confirmClear() {
	const error = E('p', { role: 'alert' });
	const cancel = E('button', { type: 'button', class: 'btn', click: () => ui.hideModal() }, _('Cancel'));
	const confirm = E('button', {
		type: 'button',
		class: 'btn cbi-button cbi-button-negative',
		click: async event => {
			const button = event.currentTarget;
			button.disabled = cancel.disabled = true;
			dom.content(error, '');
			try {
				const result = await clearHistory();
				if (result?.cleared !== true)
					throw new Error('Clear did not complete');
				ui.hideModal();
				window.location.reload();
			} catch (failure) {
				dom.content(error, _('Could not clear the DNS redirect history.'));
				button.disabled = cancel.disabled = false;
			}
		}
	}, _('Clear Entries'));
	ui.showModal(_('Clear DNS redirect history?'), [
		E('p', {}, _('This deletes all entries from this page, including the saved history.')),
		error,
		E('div', { class: 'right' }, [ cancel, ' ', confirm ])
	]);
	cancel.focus();
}

return view.extend({
	load() {
		return getHostHints().catch(() => ({}));
	},

	render(hints) {
		const names = new Map(), namesCheckedUntil = new Map();
		for (const hint of Object.values(hints || {})) {
			if (hint.name)
				for (const ip of hint.ipaddrs || hint.ipv4 || [])
					names.set(ip, hint.name);
		}

		const devices = makeTable([ _('Device'), _('Client IP'), _('Local or private'), _('Other DNS'), _('Last seen'), _('Redirects') ]);
		const localEvents = redirectSection(_('Local or private DNS destinations'), names);
		const otherEvents = redirectSection(_('Other DNS destinations'), names);
		const status = E('p', { 'role': 'status' }, _('Loading redirect history…'));
		const empty = E('em', {}, _('No redirects recorded yet.'));
		cbi_update_table(devices, [], empty);

		poll.add(async () => {
			let history;
			try {
				history = await getHistory();
			} catch (error) {
				dom.content(status, _('Unable to refresh redirect history.'));
				return;
			}

			const entries = history.entries ? history.entries.split('\n').map(line => line.split('\t')) : [];
			const byDevice = new Map();
			for (const [ time, client, server ] of entries) {
				if (!byDevice.has(client))
					byDevice.set(client, { count: 0, local: 0, last: 0 });
				const device = byDevice.get(client);
				device.count++;
				if (isLocalDestination(server))
					device.local++;
				device.last = Math.max(device.last, Number(time));
			}

			const now = Date.now();
			const unresolved = Array.from(byDevice.keys()).filter(ip => !names.has(ip) &&
				(namesCheckedUntil.get(ip) || 0) < now).slice(0, 4);
			await Promise.all(unresolved.map(async ip => {
				namesCheckedUntil.set(ip, now + 5 * 60 * 1000);
				const result = await getHostname(ip).catch(() => null);
				if (result?.name)
					names.set(ip, result.name);
			}));

			const ordered = Array.from(byDevice.entries()).sort((a, b) => b[1].count - a[1].count || b[1].last - a[1].last);
			cbi_update_table(devices, ordered.map(([ ip, stats ]) => [
				E('span', {}, names.get(ip) || ip), ip, stats.local, stats.count - stats.local, formatTime(stats.last), stats.count
			]), empty.cloneNode(true));
			const localRows = [], otherRows = [];
			for (const entry of entries.reverse()) {
				const rows = isLocalDestination(entry[2]) ? localRows : otherRows;
				rows.push(entry);
			}
			localEvents.update(localRows);
			otherEvents.update(otherRows);
			dom.content(status, _('Logged redirects') + ' ' + entries.length + ' · ' + _('Devices') + ' ' + byDevice.size);
		}, 5);

		const devicesHeading = E('div', { style: headingStyle }, [
			E('h3', {}, _('Devices')),
			L.hasViewPermission() ? E('button', {
				type: 'button', class: 'btn cbi-button cbi-button-negative', click: confirmClear
			}, _('Clear Entries')) : null
		]);
		return E([
			E('style', {}, tableStyle),
			E('h2', {}, _('DNS Redirects')),
			E('div', { style: 'padding-inline-start: 1.25rem' }, [
				E('p', {}, _('This page lists devices with hardcoded DNS entries which were caught and redirected to Pihole, or blocked outright')),
				E('p', {}, _('IPv4 DNS flows redirected to Pi-hole. Logging is rate-limited. The latest 1,000 events are saved every 30 minutes and at shutdown.')),
				status
			]),
			devicesHeading,
			E('div', { class: 'dns-redirect-scroll' }, devices),
			localEvents.node,
			otherEvents.node
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
