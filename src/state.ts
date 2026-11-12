import { CaptchaController } from './core/controller';
import { fetchRemoteRules, loadRuleSet, markFetchedToday, shouldAutoFetch, type RuleSet } from './core/rules';
import { loadSettings, saveSettings, type Settings } from './core/settings';
import { createStore } from './core/store';
import { showToast, type ToastType } from './core/toast';
import { META } from './meta';

/**
 * 应用状态和操作。这里不依赖 React：
 * 识别功能在页面加载后直接启动，React 只负责渲染设置面板。
 */
export interface AppState {
	settings: Settings;
	ruleSet: RuleSet;
	panelOpen: boolean;
}

export const store = createStore<AppState>({
	settings: loadSettings(),
	ruleSet: loadRuleSet(),
	panelOpen: false,
});

/** 按「显示通知」设置决定是否弹出提示 */
export function notify(message: string, type: ToastType = 'info'): void {
	if (store.get().settings.showNotification) showToast(message, type);
}

function setPanelOpen(open: boolean): void {
	document.body?.classList.toggle('captcha-settings-open', open);
	store.set({ panelOpen: open });
}

export const openSettings = () => setPanelOpen(true);
export const closeSettings = () => setPanelOpen(false);

/** 保存设置并立即生效 */
export function applySettings(next: Settings): void {
	try {
		saveSettings(next);
	} catch (error) {
		console.error('保存设置失败：', error);
		showToast('保存设置失败，请查看控制台', 'error');
		return;
	}
	store.set({ settings: next });
	closeSettings();
	notify('设置已保存！', 'success');
}

/** 从远程地址重新加载规则，失败时抛出错误由面板显示 */
export async function reloadRules(url: string): Promise<void> {
	if (!url.trim()) throw new Error('未填写规则地址');
	store.set({ ruleSet: await fetchRemoteRules(url.trim()) });
}

const controller = new CaptchaController({
	getSettings: () => store.get().settings,
	getRules: () => store.get().ruleSet.rules,
	toast: notify,
	openSettings,
});

/** 启动：注册菜单、按需更新规则、开始在页面上找验证码 */
export function startApp(): void {
	// 页面里的每个 iframe 都会运行脚本，菜单只在顶层页面注册一次
	if (typeof GM_registerMenuCommand !== 'undefined' && window.top === window.self) {
		GM_registerMenuCommand(`${META.name}设置`, openSettings);
	}

	const { settings } = store.get();
	if (shouldAutoFetch(settings)) {
		fetchRemoteRules(settings.rulesUrl.trim())
			.then((ruleSet) => {
				store.set({ ruleSet });
				markFetchedToday();
			})
			.catch((error) => console.error('自动获取远程规则失败：', error));
	}

	controller.start();
}
