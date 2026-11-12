import type { CaptchaInput } from './detect';

/**
 * 把识别结果写入输入框。
 * 通过原型上的 value setter 赋值，这样 React / Vue 等框架接管的输入框也能感知到变化。
 */
export function fillInput(input: CaptchaInput, text: string): void {
	const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
	const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
	if (setter) {
		setter.call(input, text);
	} else {
		input.value = text;
	}
	input.dispatchEvent(new Event('input', { bubbles: true }));
	input.dispatchEvent(new Event('change', { bubbles: true }));
}

/** 复制到剪贴板，剪贴板 API 不可用时退回 execCommand。返回是否成功 */
export async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		try {
			const textarea = document.createElement('textarea');
			textarea.value = text;
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.documentElement.appendChild(textarea);
			textarea.select();
			const ok = document.execCommand('copy');
			textarea.remove();
			return ok;
		} catch {
			return false;
		}
	}
}
