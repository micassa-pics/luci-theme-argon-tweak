'use strict';
'require view';
'require dom';
'require fs';
'require rpc';
'require ui';

const getProcesses = rpc.declare({
	object: 'luci',
	method: 'getProcessList',
	expect: { result: [] },
	reject: true
});
const getMetrics = rpc.declare({ object: 'luci.process_metrics', method: 'sample', reject: true });

/* Lucide Icons and Contributors (c) 2026, https://lucide.dev/license
 * Permission to use, copy, modify, and/or distribute this software for any purpose with or
 * without fee is hereby granted, provided that the above copyright notice and this
 * permission notice appear in all copies.
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD
 * TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS.
 * IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL
 * DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN
 * AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION
 * WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 * The Feather-derived X icon is also MIT licensed, copyright (c) 2013-present Cole Bemis.
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
 * to whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
 * PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
 * FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */
const icons = {
	'rotate-ccw': [ ['path', { d: 'M3 12a9 9 0 1 1 9 9 9.75 9.75 0 0 1-6.74-2.74L3 15' }], ['path', { d: 'M3 21v-6h6' }] ],
	'circle-stop': [ ['circle', { cx: 12, cy: 12, r: 10 }], ['rect', { x: 9, y: 9, width: 6, height: 6, rx: 1 }] ],
	x: [ ['path', { d: 'M18 6 6 18' }], ['path', { d: 'm6 6 12 12' }] ]
};

function lucide(name) {
	const namespace = 'http://www.w3.org/2000/svg';
	const icon = document.createElementNS(namespace, 'svg');
	const attrs = { class: 'lucide lucide-' + name, width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none',
		stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
		'aria-hidden': 'true', focusable: 'false' };
	for (const [ attr, value ] of Object.entries(attrs)) icon.setAttribute(attr, value);
	for (const [ tag, attributes ] of icons[name]) {
		const node = document.createElementNS(namespace, tag);
		for (const [ attr, value ] of Object.entries(attributes)) node.setAttribute(attr, value);
		icon.appendChild(node);
	}
	return icon;
}

const compactStyle = `
.processes-toolbar { display: flex; justify-content: space-between; align-items: center; gap: .5rem 1rem; flex-wrap: wrap; }
.processes-toolbar input { width: min(100%, 24rem); }
.processes-scroll { overflow-x: auto; }
.processes-scroll table.processes-table { display: table !important; min-width: 545px; table-layout: fixed; width: 100%; }
.processes-scroll .processes-table .tr { display: table-row !important; }
.processes-scroll .processes-table .tr > :is(.td, .th) { display: table-cell !important; padding: .22rem .45rem !important; vertical-align: middle; line-height: 1.25; }
.processes-scroll .processes-table .td::before { display: none; }
.processes-table .processes-sort { border: 0; background: transparent; color: inherit; font: inherit; padding: .25rem 0; cursor: pointer; }
.processes-table .processes-sort:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.processes-table .processes-sort-indicator { display: inline-block; width: 1em; }
.processes-table .processes-cell { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.processes-table .processes-memory { white-space: nowrap; }
.processes-table.has-actions .tr > :last-child { position: sticky; inset-inline-end: 0; z-index: 1; background: var(--surface-panel); }
.processes-table .processes-actions { --processes-action-size: 1.8rem; display: flex; justify-content: flex-end; gap: .2rem; flex-wrap: nowrap; }
.processes-table .processes-actions > .processes-action {
  display: inline-grid; place-items: center; box-sizing: border-box; flex: 0 0 var(--processes-action-size);
  width: var(--processes-action-size) !important; min-width: var(--processes-action-size) !important;
  height: var(--processes-action-size) !important; min-height: var(--processes-action-size) !important;
  padding: 0 !important; margin: 0 !important;
}
@media (any-pointer: coarse) {
  .processes-table .processes-actions { --processes-action-size: 2.05rem; }
}
`;

function confirmSignal(process, action, trigger, refresh) {
	const status = E('p', { role: 'alert' });
	const cancel = E('button', { type: 'button', class: 'btn cbi-button', click: () => {
		ui.hideModal();
		trigger.focus();
	} }, _('Cancel'));
	const confirm = E('button', {
		type: 'button', class: 'btn cbi-button-negative', click: async () => {
			confirm.disabled = cancel.disabled = true;
			try {
				const current = await getMetrics();
				if (current.processes[process.pid]?.[0] !== process.startTime)
					throw new Error(_('This process has exited or changed. Reload the list before trying again.'));
				const result = await fs.exec('/bin/kill', [ '-' + action.signal, String(process.pid) ]);
				if (result.code !== 0)
					throw new Error(result.stderr?.trim() || _('The process did not accept the signal.'));
				ui.hideModal();
				await refresh();
			} catch (error) {
				dom.content(status, document.createTextNode(error.message));
				confirm.disabled = cancel.disabled = false;
			}
		}
	}, action.label);
	ui.showModal(_('Confirm process action'), [
		E('p', {}, [ action.label, ' · ', _('PID'), ' ', String(process.pid) ]),
		E('p', { style: 'overflow-wrap: anywhere' }, document.createTextNode(process.command)),
		status,
		E('div', { class: 'right' }, [ cancel, ' ', confirm ])
	]);
	cancel.focus();
}

return view.extend({
	render() {
		const canSignal = L.hasViewPermission();
		const signals = [ { signal: 1, icon: 'rotate-ccw', label: _('Hang Up (SIGHUP)') },
			{ signal: 15, icon: 'circle-stop', label: _('Terminate (SIGTERM)') },
			{ signal: 9, icon: 'x', label: _('Kill (SIGKILL)') } ];
		let processes = [], totalMemory = 0, sortKey = 'pid', sortDirection = 1;
		const search = E('input', {
			type: 'search', 'aria-label': _('Search processes'), placeholder: _('Search PID, owner, or command'), input: renderRows
		});
		const columns = [['pid', _('PID'), '3.5rem'], ['owner', _('Owner'), '5rem'], ['command', _('Command'), null],
			['cpu', _('CPU'), '4.5rem'], ['resident', _('Memory'), '7.2rem']];
		const headers = columns.map(([ key, label, width ]) => {
			const indicator = E('span', { class: 'processes-sort-indicator', 'aria-hidden': 'true' });
			const button = E('button', { type: 'button', class: 'processes-sort', click: () => {
				sortDirection = sortKey === key ? -sortDirection : 1;
				sortKey = key;
				renderRows();
			} }, [ label, ' ', indicator ]);
			return { key, indicator, node: E('th', {
				class: 'th', scope: 'col', style: width ? 'width:' + width : null,
				click: event => event.stopPropagation()
			}, button) };
		});
		const headerCells = headers.map(header => header.node);
		const actionsHeading = canSignal ? E('th', {
			class: 'th', scope: 'col', style: 'width:7.55rem;text-align:end', click: event => event.stopPropagation()
		}, _('Actions')) : null;
		if (actionsHeading)
			headerCells.push(actionsHeading);
		const table = E('table', { class: 'table processes-table' + (canSignal ? ' has-actions' : '') }, [
			E('tr', { class: 'tr table-titles' }, headerCells)
		]);
		const status = E('span', { role: 'status' });
		const retry = E('button', {
			type: 'button', class: 'btn cbi-button', click: () => refresh()
		}, _('Retry'));
		const feedback = E('p', {}, [ status, ' ', retry ]);

		function renderRows() {
			for (const header of headers) {
				const active = header.key === sortKey;
				if (active) header.node.setAttribute('aria-sort', sortDirection === 1 ? 'ascending' : 'descending');
				else header.node.removeAttribute('aria-sort');
				dom.content(header.indicator, active ? (sortDirection === 1 ? '↑' : '↓') : '↕');
			}
			const query = search.value.trim().toLowerCase();
			const filtered = processes.filter(process => !query ||
				[process.pid, process.owner, process.command].join(' ').toLowerCase().includes(query));
			filtered.sort((a, b) => {
				const left = a[sortKey], right = b[sortKey];
				if (left == null || right == null) return left == null && right == null ? a.pid - b.pid : left == null ? 1 : -1;
				const order = typeof left === 'number' ? left - right : left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
				return sortDirection * order || a.pid - b.pid;
			});
			const rows = filtered.map(process => {
				const command = E('span', { class: 'processes-cell', title: process.command }, document.createTextNode(process.command));
				const owner = E('span', { class: 'processes-cell', title: process.owner }, document.createTextNode(process.owner));
				const cpu = process.cpu == null ? '—' : process.cpu.toFixed(2) + '%';
				const memory = process.resident != null && totalMemory > 0 ? E('span', { class: 'processes-memory' }, [
					(100 * process.resident / totalMemory).toFixed(2) + '%', ' ',
					E('small', {}, (process.resident / 1024).toFixed(2) + ' MiB')
				]) : '—';
				const row = [ process.pid, owner, command, cpu, memory ];
				if (canSignal)
					row.push(E('div', { class: 'processes-actions' }, signals.map(action => E('button', {
						type: 'button', class: 'btn cbi-button processes-action',
						'aria-label': action.label, 'data-tooltip': action.label,
						disabled: process.startTime == null ? '' : null,
						click: event => confirmSignal(process, action, event.currentTarget, refresh)
					}, lucide(action.icon)))));
				return row;
			});
			cbi_update_table(table, rows, E('em', {}, query ? _('No processes match your search.') : _('No processes were returned.')));
			actionsHeading?.removeAttribute('data-sortable-row');
		}

		async function refresh() {
			feedback.hidden = false;
			retry.hidden = true;
			dom.content(status, _('Loading running processes…'));
			try {
				const before = await getMetrics();
				await new Promise(resolve => window.setTimeout(resolve, 1000));
				const [ list, current ] = await Promise.all([ getProcesses(), getMetrics() ]);
				const totalTicks = current.cpuTicks - before.cpuTicks;
				totalMemory = current.memoryKiB;
				processes = list.map(proc => {
					const previous = before.processes[proc.PID];
					const latest = current.processes[proc.PID];
					const cpu = previous && latest && previous[0] === latest[0] && totalTicks > 0 && latest[1] >= previous[1]
						? 100 * (latest[1] - previous[1]) / totalTicks : null;
					return { pid: Number(proc.PID), owner: proc.USER ?? '', command: proc.COMMAND ?? '',
						cpu, resident: latest?.[2], startTime: latest?.[0] };
				});
				renderRows();
				feedback.hidden = true;
			} catch (error) {
				dom.content(status, _('Could not load the process list.'));
				retry.hidden = false;
			}
		}

		refresh();
		return E([
			E('style', {}, compactStyle),
			E('div', { class: 'processes-toolbar' }, [ E('h2', {}, _('Processes')), search ]),
			feedback,
			E('div', { class: 'cbi-section processes-scroll' }, table)
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
