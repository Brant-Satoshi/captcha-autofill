import { useSyncExternalStore } from 'react';
import { SettingsPanel } from './components/SettingsPanel';
import { applySettings, closeSettings, openSettings, reloadRules, store } from './state';

export function App() {
	const { settings, ruleSet, panelOpen } = useSyncExternalStore(store.subscribe, store.get);

	return (
		<div className="captcha-recognition-container">
			{/* 仅开发环境：没有脚本管理器菜单时用这个按钮打开设置 */}
			{import.meta.env.DEV && !panelOpen && (
				<div className="dev-settings-button" title="打开设置" onClick={openSettings}>
					⚙
				</div>
			)}

			{/* 面板只在打开时挂载，所以每次打开都从已保存的设置开始编辑 */}
			{panelOpen && (
				<>
					<div className="captcha-settings-overlay" onClick={closeSettings} />
					<SettingsPanel
						settings={settings}
						ruleSet={ruleSet}
						reloadRules={reloadRules}
						onSave={applySettings}
						onClose={closeSettings}
					/>
				</>
			)}
		</div>
	);
}
