'use strict';

import { open, readfile } from 'fs';

function replaceOnce(source, marker, replacement) {
	const offset = index(source, marker);
	if (offset < 0 || index(substr(source, offset + length(marker)), marker) >= 0)
		die('Expected exactly one match for ' + marker);
	return substr(source, 0, offset) + replacement + substr(source, offset + length(marker));
}

const stage = ARGV[0];
const ui = readfile('/www/luci-static/resources/ui.js');
const placement = trim(readfile(stage + '/argon-touch-dropdown.js'));
if (index(ui, 'function placeArgonTouchDropdown(') >= 0) exit(0);
const popupInserted = 'sb.insertBefore(pv,ul.nextElementSibling);';
const closeDropdown = "ul.classList.remove('dropdown');ul.style.top=ul.style.bottom=ul.style.maxHeight='';";
let patched = replaceOnce(ui, popupInserted, popupInserted + "\nif ('ontouchstart' in window) (" + placement + ')(sb, ul);\n');
patched = replaceOnce(patched, closeDropdown, closeDropdown + `
if (ul.classList.contains('argon-touch-dropdown')) {
	ul.classList.remove('argon-touch-dropdown');
	ul.style.left = ul.style.right = ul.style.width = '';
}
`);

const jsFile = open(ARGV[1], 'w');
if (!jsFile) die('Cannot stage dropdown update');
jsFile.write(patched);
jsFile.close();
