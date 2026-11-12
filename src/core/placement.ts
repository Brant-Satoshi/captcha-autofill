/**
 * 识别图标放在哪里。
 *
 * 个别网站的布局里，把图标紧跟在验证码后面会被遮挡或挤乱，
 * placements 按域名指定图标应该放到哪里。返回 true 表示已处理。
 */
type Placement = (icon: HTMLElement) => boolean;

const placements: Record<string, Placement> = {
	'nportal.ntut.edu.tw': (icon) => {
		const box = document.querySelector('.authcode.co');
		if (!box) return false;
		box.appendChild(icon);
		return true;
	},
	'www.luogu.com.cn': (icon) => {
		const box = document.querySelector('.l-form-layout .img');
		if (!box?.parentNode) return false;
		box.parentNode.insertBefore(icon, box.nextSibling);
		return true;
	},
};

const OVERLAY_CLASS = 'captcha-recognition-overlay';
/** 叠放时图标离图片边缘的距离（像素） */
const INSET = 2;
/** 叠放的图标当前的偏移量 */
const offsets = new WeakMap<HTMLElement, { x: number; y: number }>();

/** 把识别图标插入页面：默认紧跟在验证码元素后面，个别网站走专门的位置 */
export function placeIcon(captcha: Element, icon: HTMLElement): void {
	const custom = placements[location.host];
	if (custom?.(icon)) return;
	captcha.after(icon);
	adjustIcon(captcha, icon);
}

/**
 * 检查图标是否排在了验证码旁边，必要时调整。
 *
 * 有些网站用一个和图片一样大的容器包住验证码，紧跟其后的图标会被挤到下一行，
 * 甚至盖住输入框。这时把图标改为叠在图片右上角：它不再占位置，也不会挤开页面上的其他元素。
 * 页面布局可能变化，所以控制器会定期调用这个函数。
 */
export function adjustIcon(captcha: Element, icon: HTMLElement): void {
	// 专门适配过位置的网站不处理
	if (icon.previousElementSibling !== captcha) return;
	const box = captcha.getBoundingClientRect();
	// 验证码不可见时无法测量
	if (!box.width || !box.height) return;

	if (!icon.classList.contains(OVERLAY_CLASS)) {
		const rect = icon.getBoundingClientRect();
		const besideCaptcha = rect.top < box.bottom - 2;
		if (!rect.width || besideCaptcha) return;
		icon.classList.add(OVERLAY_CLASS);
	}

	// 叠放的图标是绝对定位的，用外边距从它原本的位置挪到图片右上角
	const rect = icon.getBoundingClientRect();
	const prev = offsets.get(icon) ?? { x: 0, y: 0 };
	const x = Math.round(prev.x + (box.right - rect.width - INSET) - rect.left);
	const y = Math.round(prev.y + (box.top + INSET) - rect.top);
	if (x === prev.x && y === prev.y) return;
	offsets.set(icon, { x, y });
	icon.style.setProperty('margin-left', `${x}px`, 'important');
	icon.style.setProperty('margin-top', `${y}px`, 'important');
}
