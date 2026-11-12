import type { CaptchaElement } from './detect';

export type ImageResult = { ok: true; data: string } | { ok: false; message: string };

const fail = (message: string): ImageResult => ({ ok: false, message });

/** base64 太短说明图片是空的 */
const MIN_LENGTH = 100;

function isSameOrigin(url: string): boolean {
	try {
		return new URL(url, location.href).origin === location.origin;
	} catch {
		return false;
	}
}

function canvasToBase64(canvas: HTMLCanvasElement, emptyMessage: string): ImageResult {
	const data = canvas.toDataURL('image/png').split(',')[1];
	return data && data.length >= MIN_LENGTH ? { ok: true, data } : fail(emptyMessage);
}

/**
 * 把验证码元素转成 PNG 的 base64（不含 data: 前缀）。
 *
 * 跨域图片不能直接读取像素：这里会给图片加上 crossOrigin 并重新加载一次，
 * 本次返回失败，等图片重新加载完成后再调用即可。
 */
export function elementToBase64(element: CaptchaElement): ImageResult {
	try {
		if (element instanceof HTMLCanvasElement) {
			try {
				return canvasToBase64(element, 'Canvas 内容为空，请刷新验证码后重试');
			} catch (error) {
				return fail('无法读取 Canvas，可能是跨域限制。' + ((error as Error).message || ''));
			}
		}

		const src = element.src;
		if (!element.complete || !element.naturalWidth) {
			return fail('图片尚未加载完成，请稍后重试');
		}

		if (!src.startsWith('data:image') && !isSameOrigin(src) && element.crossOrigin !== 'anonymous') {
			element.crossOrigin = 'anonymous';
			// 加时间戳强制重新加载
			element.src = `${src}${src.includes('?') ? '&' : '?'}_t=${Date.now()}`;
			return fail('正在处理跨域图片，请稍后重试');
		}

		const canvas = document.createElement('canvas');
		canvas.width = element.naturalWidth || element.width;
		canvas.height = element.naturalHeight || element.height;
		const ctx = canvas.getContext('2d');
		if (!ctx) return fail('无法创建 Canvas');

		try {
			ctx.drawImage(element, 0, 0);
			// 跨域图片在这里会抛出错误
			ctx.getImageData(0, 0, 1, 1);
			return canvasToBase64(canvas, '图片内容为空，请刷新验证码后重试');
		} catch {
			return fail('无法读取图片数据，可能是跨域限制');
		}
	} catch (error) {
		return fail('图片转换失败：' + ((error as Error).message || '未知错误'));
	}
}

/** 等图片加载完成（已加载则立即返回），最多等 timeoutMs */
export function whenImageReady(element: CaptchaElement, timeoutMs = 5000): Promise<void> {
	if (!(element instanceof HTMLImageElement) || (element.complete && element.naturalWidth)) {
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		const done = () => {
			clearTimeout(timer);
			element.removeEventListener('load', done);
			element.removeEventListener('error', done);
			resolve();
		};
		const timer = setTimeout(done, timeoutMs);
		element.addEventListener('load', done);
		element.addEventListener('error', done);
	});
}

/** 现场画一张简单的验证码图片，用于「测试连接」 */
export function makeTestImage(text = 'A7K9'): string {
	const canvas = document.createElement('canvas');
	canvas.width = 140;
	canvas.height = 48;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = '#222';
	ctx.font = 'bold 30px monospace';
	ctx.textBaseline = 'middle';
	ctx.fillText(text, 22, 25);
	return canvas.toDataURL('image/png').split(',')[1] ?? '';
}
