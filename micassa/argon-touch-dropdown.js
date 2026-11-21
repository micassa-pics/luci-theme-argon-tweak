function placeArgonTouchDropdown(dropdown, popup) {
	const content = dropdown.closest('.main-right');
	const modal = dropdown.closest('.modal');
	if ((!content && !modal) || !document.querySelector('link[href*="/argon/css/cascade.css"]'))
		return;

	const pane = modal || content;
	const gutter = 8;
	const minimumWidth = 320;
	const viewportWidth = document.documentElement.clientWidth;
	const anchor = dropdown.getBoundingClientRect();
	const paneLeft = pane.getBoundingClientRect().left + pane.clientLeft;
	const left = Math.max(0, paneLeft) + gutter;
	const right = Math.min(viewportWidth, paneLeft + pane.clientWidth) - gutter;
	if (right <= left)
		return;

	const width = Math.min(Math.max(anchor.width, minimumWidth), right - left);
	const x = Math.min(Math.max(anchor.left, left), right - width);
	popup.classList.add('argon-touch-dropdown');
	popup.style.left = `${x - anchor.left - dropdown.clientLeft}px`;
	popup.style.right = 'auto';
	popup.style.width = `${width}px`;
}
