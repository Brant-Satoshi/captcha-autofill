/**
 * 个别网站的布局里，把图标紧跟在验证码后面会被遮挡或挤乱，
 * 这里按域名指定图标应该放到哪里。返回 true 表示已处理。
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

/** 把识别图标插入页面：默认紧跟在验证码元素后面，个别网站走专门的位置 */
export function placeIcon(captcha: Element, icon: HTMLElement): void {
	const custom = placements[location.host];
	if (custom?.(icon)) return;
	captcha.after(icon);
}
