import { DEFAULT_PROMPT } from '../prompts';
import { isConfigured, recognizeImage } from '../providers';
import { findCaptchaElements, findInputFor, resolveSelectors, type CaptchaElement, type SelectorSet } from './detect';
import { copyText, fillInput } from './fill';
import { elementToBase64, whenImageReady } from './image';
import { isDomainDisabled } from './pattern';
import type { Rule } from './rules';
import type { Settings } from './settings';
import { placeIcon } from './siteFixes';
import type { ToastType } from './toast';

export interface ControllerDeps {
	getSettings(): Settings;
	getRules(): Rule[];
	toast(message: string, type?: ToastType): void;
	openSettings(): void;
}

const ICON_CLASS = 'captcha-recognition-icon';
/** 页面加载完成后再等一会儿，让验证码图片有时间出现 */
const BOOT_DELAY = 1000;
/** 轮询间隔：兜底发现那些不触发 DOM 变化事件的验证码 */
const SCAN_INTERVAL = 500;
/** DOM 变化后延迟多久扫描 */
const SCAN_DEBOUNCE = 100;

/**
 * 页面上的全部行为都在这里：找验证码、挂识别图标、监听变化、识别并回填。
 * 不依赖界面框架，设置和规则通过 deps 读取，所以保存设置后立即生效。
 */
export class CaptchaController {
	/** 验证码元素 -> 它的识别图标 */
	private icons = new WeakMap<Element, HTMLElement>();
	/** 验证码元素 -> 上一次送去识别的图片，用来避免自动模式下重复识别同一张图 */
	private lastImage = new WeakMap<Element, string>();
	/** 正在识别中的验证码元素 */
	private busy = new WeakSet<Element>();
	private started = false;
	private scanQueued = false;

	constructor(private deps: ControllerDeps) {}

	start(): void {
		if (this.started) return;
		this.started = true;
		const boot = () => setTimeout(() => this.boot(), BOOT_DELAY);
		if (document.readyState === 'complete') boot();
		else window.addEventListener('load', boot, { once: true });
	}

	private get settings(): Settings {
		return this.deps.getSettings();
	}

	private get disabled(): boolean {
		return isDomainDisabled(this.settings.disabledDomains, location.hostname);
	}

	private selectors(): SelectorSet {
		return resolveSelectors(this.settings, this.deps.getRules(), location);
	}

	private boot(): void {
		this.scan();
		this.observe();
		setInterval(() => this.scan(), SCAN_INTERVAL);
	}

	/** 页面频繁变化时合并成一次扫描 */
	private scheduleScan(): void {
		if (this.scanQueued) return;
		this.scanQueued = true;
		setTimeout(() => {
			this.scanQueued = false;
			this.scan();
		}, SCAN_DEBOUNCE);
	}

	/** 找出还没有挂图标的验证码，挂上图标；开启自动识别时顺便识别 */
	private scan(): void {
		if (this.disabled) return;
		const fresh = findCaptchaElements(this.selectors().captcha).filter((el) => !this.icons.get(el)?.isConnected);
		if (!fresh.length) return;

		fresh.forEach((el) => this.attachIcon(el));
		if (this.settings.autoRecognize) {
			fresh.forEach((el) => void whenImageReady(el).then(() => this.recognize(el, true)));
		} else {
			this.deps.toast(`检测到 ${fresh.length} 个验证码，点击识别图标开始识别`, 'info');
		}
	}

	private attachIcon(captcha: CaptchaElement): HTMLElement {
		const existing = this.icons.get(captcha);
		if (existing?.isConnected) return existing;

		const icon = document.createElement('div');
		icon.className = ICON_CLASS;
		icon.title = '点击识别验证码';
		icon.addEventListener('click', (event) => {
			// 图标可能位于链接或表单内，避免触发页面自己的点击行为
			event.preventDefault();
			event.stopPropagation();
			void this.recognize(captcha, false);
		});
		placeIcon(captcha, icon);
		this.icons.set(captcha, icon);
		return icon;
	}

	/** 监听 DOM：新增节点时立即扫描；已知验证码换图时自动识别 */
	private observe(): void {
		const observer = new MutationObserver((mutations) => {
			if (this.disabled) return;
			let added = false;
			const changed = new Set<CaptchaElement>();

			for (const mutation of mutations) {
				if (mutation.type === 'childList' && mutation.addedNodes.length) {
					added = true;
				} else if (mutation.type === 'attributes' && mutation.target instanceof HTMLImageElement) {
					if (this.icons.has(mutation.target)) changed.add(mutation.target);
					else added = true; // 可能是刚拿到 src 的验证码图片
				}
			}

			if (added) this.scheduleScan();
			if (this.settings.autoRecognize) {
				changed.forEach((el) => void whenImageReady(el).then(() => this.recognize(el, true)));
			}
		});
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['src'],
		});
	}

	/** 图标短暂显示成功或失败状态 */
	private flash(icon: HTMLElement, state: 'success' | 'error'): void {
		const cls = `captcha-recognition-${state}`;
		icon.classList.add(cls);
		setTimeout(() => icon.classList.remove(cls), 2000);
	}

	/**
	 * 识别一个验证码并回填。
	 * @param auto 是否由自动识别触发。自动模式下同一张图不会重复识别，也不会主动弹出设置面板。
	 */
	async recognize(captcha: CaptchaElement, auto: boolean): Promise<void> {
		const { toast } = this.deps;
		if (this.disabled) {
			if (!auto) toast('当前网站已设置为不启用验证码识别功能', 'info');
			return;
		}
		if (this.busy.has(captcha)) return;

		const settings = this.settings;
		const icon = this.attachIcon(captcha);

		const image = elementToBase64(captcha);
		if (!image.ok) {
			toast(image.message, 'error');
			this.flash(icon, 'error');
			return;
		}
		if (auto && this.lastImage.get(captcha) === image.data) return;

		const config = settings.providers[settings.provider];
		if (!isConfigured(settings.provider, config)) {
			toast('请先在设置中配置识别服务', 'error');
			if (!auto) this.deps.openSettings();
			return;
		}

		this.busy.add(captcha);
		this.lastImage.set(captcha, image.data);
		icon.classList.add('captcha-recognition-loading');
		toast('正在识别验证码...', 'info');

		let text = '';
		try {
			text = await recognizeImage(settings.provider, config, settings.prompt.trim() || DEFAULT_PROMPT, image.data);
		} catch (error) {
			console.error('验证码识别失败：', error);
			toast('识别失败：' + ((error as Error).message || '未知错误'), 'error');
			this.flash(icon, 'error');
			return;
		} finally {
			this.busy.delete(captcha);
			icon.classList.remove('captcha-recognition-loading');
		}

		if (!text) {
			toast('识别结果为空', 'error');
			this.flash(icon, 'error');
			return;
		}

		// 识别完成后再找输入框，页面在此期间可能已经变化
		const input = findInputFor(captcha, this.selectors().input);
		if (input) fillInput(input, text);
		const copied = settings.copyToClipboard && (await copyText(text));

		const where = input ? '' : '，但未找到输入框';
		toast(`验证码已识别：${text}${where}${copied ? '（已复制到剪贴板）' : ''}`, input || copied ? 'success' : 'warning');
		this.flash(icon, 'success');
	}
}
