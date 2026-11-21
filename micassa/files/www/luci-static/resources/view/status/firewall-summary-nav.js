'use strict';
'require view';
'require dom';
'require fs';

const groups = [
	{ id: 'dns', title: _('DNS protection'), open: true },
	{ id: 'forwards', title: _('Port forwards'), open: true },
	{ id: 'traffic', title: _('Traffic rules'), open: false },
	{ id: 'lists', title: _('IP blocklists'), open: false },
	{ id: 'system', title: _('System rules'), open: false }
];

const style = `
.fw-summary-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .65rem; }
.fw-summary-toolbar h2 { margin: 0; }
.fw-summary-controls { display: flex; flex-wrap: wrap; align-items: center; gap: .45rem; }
.fw-summary-search { margin: .75rem 0; width: min(100%, 28rem); }
.fw-summary-group { border: 1px solid var(--border-color, #555); border-radius: .55rem; margin: .6rem 0; padding: 0 .75rem; }
.fw-summary-group[hidden], .fw-summary-rule[hidden], .fw-summary-status[hidden] { display: none !important; }
.fw-summary-group > summary { padding: .75rem 0; cursor: pointer; font-weight: 600; }
.fw-summary-group > summary span { margin-inline-start: .4rem; }
.fw-summary-row, .fw-summary-labels { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1.2fr) minmax(0, 1fr) 8rem; gap: .3rem .8rem; align-items: start; }
.fw-summary-labels { padding: .35rem 0 .45rem; font-size: .85em; font-weight: 600; }
.fw-summary-labels > :first-child { padding-inline-start: .85rem; }
.fw-summary-rule { border-top: 1px solid var(--border-color, #555); }
.fw-summary-rule > summary { padding: .6rem 0; cursor: pointer; list-style: none; }
.fw-summary-rule > summary::-webkit-details-marker { display: none; }
.fw-summary-name { font-weight: 600; overflow-wrap: anywhere; }
.fw-summary-name::before { content: '›'; width: .5rem; margin-inline-end: .35rem; display: inline-block; }
.fw-summary-rule[open] .fw-summary-name::before { transform: rotate(90deg); }
.fw-summary-action, .fw-summary-traffic { overflow-wrap: anywhere; }
.fw-summary-count { text-align: end; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.fw-summary-details { margin: 0 0 .6rem .85rem; padding: .5rem .75rem; border-inline-start: 2px solid var(--border-color, #555); }
.fw-summary-details li { margin: .2rem 0; overflow-wrap: anywhere; }
.fw-summary-details p { margin: .3rem 0; }
@media (max-width: 1000px) {
  .fw-summary-row { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) 6rem; }
  .fw-summary-labels { display: none; }
  .fw-summary-name { grid-column: 1 / 3; }
  .fw-summary-traffic { grid-area: 2 / 1 / 2 / 2; }
  .fw-summary-action { grid-area: 2 / 2 / 2 / 4; }
  .fw-summary-count { grid-area: 1 / 3 / 1 / 4; }
}
`;

function text(value) {
	return document.createTextNode(String(value));
}

function expression(value) {
	if (value == null || typeof value !== 'object') return String(value);
	if (Array.isArray(value)) return value.map(expression).join(', ');
	if (value.set) return '{ ' + expression(value.set) + ' }';
	if (value.range) return value.range.map(expression).join('–');
	if (value.prefix) return expression(value.prefix.addr) + '/' + value.prefix.len;
	if (value.concat) return value.concat.map(expression).join(' · ');
	return JSON.stringify(value);
}

function fieldName(value) {
	if (!value || typeof value !== 'object') return expression(value);
	const meta = { iifname: _('Incoming interface'), oifname: _('Outgoing interface'), l4proto: _('Protocol'), nfproto: _('Address family') };
	const fields = { saddr: _('Source address'), daddr: _('Destination address'), sport: _('Source port'), dport: _('Destination port') };
	if (value.meta) return meta[value.meta.key] ?? _('Packet metadata') + ' ' + value.meta.key;
	if (value.ct) return _('Connection') + ' ' + value.ct.key;
	if (value.payload) return (['th', 'ip', 'ip6'].includes(value.payload.protocol) ? '' : value.payload.protocol.toUpperCase() + ' ') +
		(fields[value.payload.field] ?? value.payload.field);
	return expression(value);
}

function describeMatch(match) {
	return fieldName(match.left) + ' ' + ({ '==': _('is'), '!=': _('is not'), in: _('is in') }[match.op] ?? match.op) + ' ' + expression(match.right);
}

function describeAction(item) {
	const [ kind, value ] = Object.entries(item)[0] ?? [];
	const targets = { dnat: _('Redirect to'), snat: _('Rewrite source to') };
	if (kind === 'dnat' || kind === 'snat') {
		const address = value.addr ? expression(value.addr) : '';
		const target = value.port != null ? (address.includes(':') ? '[' + address + ']' : address) + ':' + expression(value.port) : address;
		return targets[kind] + ' ' + target;
	}
	const target = value?.target;
	if (target && ['jump', 'goto'].includes(kind)) {
		if (target === '_reject' || /^reject_(to|from)_/.test(target)) return _('Reject');
		if (target === '_drop' || /^drop_(to|from)_/.test(target)) return _('Drop');
		if (target === '_accept' || /^accept_(to|from)_/.test(target)) return _('Allow');
		return _('Continue in') + ' ' + target;
	}
	const labels = { accept: _('Allow'), reject: _('Reject'), drop: _('Drop'), return: _('Return to caller'),
		masquerade: _('Masquerade'), redirect: _('Redirect'), log: _('Log'), limit: _('Rate limit'),
		mangle: _('Change packet metadata'), notrack: _('Skip connection tracking'), counter: _('Count matches') };
	return labels[kind] ?? kind ?? _('Inspect rule');
}

function directionFor(rule) {
	const directions = { forward_lan: _('From LAN'), forward_wan: _('From WAN'), dstnat_wan: _('WAN → LAN'),
		input_lan: _('LAN → router'), input_wan: _('WAN → router'), _outbound: _('LAN → internet'),
		_inbound: _('Internet → LAN'), input: _('To router'), output: _('From router'),
		pihole_dns_redirect: _('From LAN'), pihole_dns_hairpin: _('Within LAN') };
	return directions[rule.chain] ?? rule.chain;
}

function buildRows(ruleset) {
	const grouped = new Map();
	for (const { rule } of ruleset) {
		if (!rule || !Array.isArray(rule.expr)) continue;
		const name = (rule.comment ?? '').replace(/^!fw4: /, '');
		const matches = rule.expr.filter(item => item.match).map(item => item.match);
		const ports = matches.filter(match => match.op === '==' && match.left?.payload?.field === 'dport');
		const set = matches.find(match => typeof match.right === 'string' && match.right.startsWith('@'))?.right;
		const verdict = rule.expr.find(item => ['accept', 'reject', 'drop', 'dnat', 'snat', 'masquerade', 'redirect', 'jump', 'goto', 'return'].some(key => key in item));
		const port = ports.length === 1 ? expression(ports[0].right).replace(/^\{ | \}$/g, '') : '';
		const protocol = matches.find(match => match.op === '==' && match.left?.meta?.key === 'l4proto')?.right ?? ports[0]?.left.payload?.protocol;
		let group = 'system', title = name;
		if (rule.chain === 'pihole_dns_redirect' && verdict?.dnat) {
			group = 'dns'; title = _('Force DNS through Pi-hole');
		} else if (name === 'Deny-DoT') {
			group = 'dns'; title = _('Block encrypted DNS on port 853');
		} else if (name === 'Reject public IPv6 DNS') {
			group = 'dns'; title = _('Block public IPv6 DNS');
		} else if (rule.table === 'banIP' && /^@doh\./i.test(set ?? '')) {
			group = 'dns'; title = _('Block known DoH servers');
		} else if (rule.table === 'banIP' && set && verdict) {
			group = 'lists'; title = set.slice(1);
		} else if (verdict?.dnat && !name.endsWith('(reflection)')) {
			group = 'forwards'; title ||= _('Port forward');
		} else if (rule.table === 'fw4' && name && /^(input|output|forward)_/.test(rule.chain) &&
			!/^Handle |^Accept port forwards|^Reject traffic|^drop |^accept |^reject /.test(name)) {
			group = 'traffic';
		}
		const action = describeAction(verdict ?? rule.expr.find(item => item.log) ?? rule.expr.at(-1) ?? {});
		title ||= rule.chain === 'pihole_dns_hairpin' ? _('Keep redirected DNS replies on the same path') :
			rule.chain === 'pihole_dns_redirect' && rule.expr.some(item => item.log) ? _('Log redirected DNS attempts') :
			action;
		let direction = directionFor(rule);
		if (verdict?.jump?.target === 'reject_to_wan' && rule.chain === 'forward_lan') direction = _('LAN → WAN');
		const key = group === 'system' ? 'system-' + grouped.size : JSON.stringify([group, rule.family, rule.table, rule.chain, title, action, port]);
		if (!grouped.has(key))
			grouped.set(key, { group, title, action, direction, port, replies: [], protocols: new Set(), hits: 0, allCounted: true });
		const row = grouped.get(key);
		if (protocol && protocol !== 'th') {
			const protocols = protocol.set ?? (Array.isArray(protocol) ? protocol : [protocol]);
			for (const item of protocols) row.protocols.add(expression(item).toUpperCase());
		}
		const counters = rule.expr.filter(item => item.counter && typeof item.counter.packets === 'number');
		row.hits += counters.reduce((n, item) => n + item.counter.packets, 0);
		row.allCounted &&= counters.length > 0;
		row.replies.push({ rule, matches, nonMatches: rule.expr.filter(item => !item.match), counters });
	}
	return [...grouped.values()];
}

function describeStep(step) {
	if (step.counter) {
		if (typeof step.counter.packets !== 'number') return _('Counter') + ' ' + expression(step.counter);
		return _('Counter') + ' ' + step.counter.packets.toLocaleString() + ' ' + _('packets') +
			(typeof step.counter.bytes === 'number' ? ' · ' + step.counter.bytes.toLocaleString() + ' ' + _('bytes') : '');
	}
	// Preserve unfamiliar options in the details so the summary never drops rule conditions.
	return describeAction(step) + ' · ' + JSON.stringify(step);
}

function ruleRow(row, detailedUrl) {
	const traffic = [row.direction, [...row.protocols].join(' / '), row.port ? _('port') + ' ' + row.port : ''].filter(Boolean).join(' · ');
	const label = row.allCounted ? row.hits.toLocaleString() + ' ' + _('packets') : '—';
	const node = E('details', { class: 'fw-summary-rule', 'data-rule-count': row.replies.length }, [
		E('summary', { class: 'fw-summary-row' }, [
			E('span', { class: 'fw-summary-name' }, text(row.title)),
			E('span', { class: 'fw-summary-traffic' }, text(traffic)),
			E('span', { class: 'fw-summary-action' }, text(row.action)),
			E('span', { class: 'fw-summary-count', title: row.allCounted ? _('Matched packets') : _('Packet count unavailable') }, text(label))
		])
	]);
	// Construct the details only when opened. The live ruleset can be large.
	node.addEventListener('toggle', () => {
		if (!node.open || node.childElementCount > 1) return;
		for (const { rule, matches, nonMatches } of row.replies) {
			const anchor = '#' + encodeURIComponent(rule.table + '.' + rule.chain);
			node.appendChild(E('div', { class: 'fw-summary-details' }, [
				E('p', {}, [ E('a', { href: detailedUrl + anchor }, text(rule.table + ' / ' + rule.chain)),
					text(rule.family ? ' · ' + rule.family : '') ]),
				E('ul', {}, [...matches.map(describeMatch), ...nonMatches.map(describeStep)].map(line => E('li', {}, text(line))))
			]));
		}
	});
	return { node, search: [row.title, traffic, row.action, ...row.replies.flatMap(({ rule, matches, nonMatches }) =>
		[rule.table, rule.chain, rule.comment, ...matches.map(describeMatch), ...nonMatches.map(describeStep)]
	)].filter(Boolean).join(' ').toLowerCase() };
}

return view.extend({
	render() {
		const detailedUrl = L.url('admin/status/nftables-detail');
		if (/^#[\w.%-]+$/.test(window.location.hash)) {
			window.location.replace(detailedUrl + window.location.hash);
			return E('p', {}, _('Opening detailed firewall rules…'));
		}

		const results = E('div');
		const status = E('p', { class: 'fw-summary-status', role: 'status' });
		const search = E('input', { type: 'search', class: 'fw-summary-search', 'aria-label': _('Search firewall rules'),
			placeholder: _('Search rules, addresses, or ports'), input: applySearch });
		const refresh = E('button', { type: 'button', class: 'btn cbi-button', click: loadRules }, _('Refresh'));
		let sections = [], openBeforeSearch;

		function applySearch() {
			const query = search.value.trim().toLowerCase();
			const terms = query ? query.split(/\s+/) : [];
			if (query && !openBeforeSearch) openBeforeSearch = new Map(sections.map(section => [section.id, section.wrapper.open]));
			let shown = 0;
			for (const section of sections) {
				let count = 0;
				for (const row of section.rows) {
					row.node.hidden = !terms.every(term => row.search.includes(term));
					if (!row.node.hidden) count++;
				}
				shown += count;
				section.wrapper.hidden = count === 0;
				if (query && count) section.wrapper.open = true;
				if (!query && openBeforeSearch) section.wrapper.open = openBeforeSearch.get(section.id);
				dom.content(section.count, String(count));
			}
			if (!query) openBeforeSearch = null;
			if (sections.length) {
				status.hidden = shown !== 0;
				if (!shown) dom.content(status, _('No firewall rules match your search.'));
			}
		}

		async function loadRules() {
			refresh.disabled = true;
			status.hidden = false;
			dom.content(status, _('Reading active firewall rules…'));
			try {
				const data = await fs.exec_direct('/usr/sbin/nft', ['--terse', '--json', 'list', 'ruleset'], 'json');
				if (!Array.isArray(data?.nftables)) throw new Error('Ruleset unavailable');
				const rows = buildRows(data.nftables);
				const open = new Map(sections.map(section => [section.id, section.wrapper.open]));
				sections = groups.map(group => {
					const count = E('span');
					const rowsInGroup = rows.filter(row => row.group === group.id).map(row => ruleRow(row, detailedUrl));
					const wrapper = E('details', { class: 'fw-summary-group', 'data-group': group.id }, [
						E('summary', {}, [text(group.title), text(' '), count]),
						E('div', { class: 'fw-summary-labels' }, [E('span', {}, _('Rule')), E('span', {}, _('Traffic')),
							E('span', {}, _('Result')), E('span', { class: 'fw-summary-count' }, _('Hits'))]),
						...rowsInGroup.map(row => row.node)
					]);
					wrapper.open = open.get(group.id) ?? group.open;
					return { id: group.id, wrapper, count, rows: rowsInGroup };
				});
				results.replaceChildren(...sections.map(section => section.wrapper));
				applySearch();
				if (!rows.length) {
					status.hidden = false;
					dom.content(status, _('The active ruleset has no rules.'));
				}
			} catch (error) {
				dom.content(status, _('Could not read the active firewall rules.'));
			} finally {
				refresh.disabled = false;
			}
		}

		loadRules();
		return E([
			E('style', {}, style),
			E('div', { class: 'fw-summary-toolbar' }, [
				E('h2', {}, _('Firewall Summary')),
				E('div', { class: 'fw-summary-controls' }, refresh)
			]),
			search, status, results
		]);
	},
	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
