import { useState } from 'react';
import { version } from '../../package.json';
import type { RuleSet } from '../core/rules';
import { cloneSettings, type Settings } from '../core/settings';
import { META } from '../meta';
import { AdvancedTab } from './tabs/AdvancedTab';
import { DomainTab } from './tabs/DomainTab';
import { FunctionTab } from './tabs/FunctionTab';
import { ProviderTab } from './tabs/ProviderTab';

interface Props {
	settings: Settings;
	ruleSet: RuleSet;
	reloadRules: (url: string) => Promise<void>;
	onSave: (settings: Settings) => void;
	onClose: () => void;
}

const TABS = [
	{ id: 'ai', label: 'AI 服务商' },
	{ id: 'function', label: '功能设置' },
	{ id: 'domain', label: '禁用域名' },
	{ id: 'advanced', label: '高级设置' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const cleanList = (list: string[]) => list.map((item) => item.trim()).filter(Boolean);

export function SettingsPanel({ settings, ruleSet, reloadRules, onSave, onClose }: Props) {
	// 在副本上编辑，点「保存」才生效，点「取消」直接丢弃
	const [draft, setDraft] = useState(() => cloneSettings(settings));
	const [activeTab, setActiveTab] = useState<TabId>('ai');

	const update = (patch: Partial<Settings>) => setDraft((prev) => ({ ...prev, ...patch }));

	const save = () =>
		onSave({
			...cloneSettings(draft),
			customCaptchaSelectors: cleanList(draft.customCaptchaSelectors),
			customInputSelectors: cleanList(draft.customInputSelectors),
		});

	return (
		<div className="captcha-settings-modal show" onClick={(event) => event.stopPropagation()}>
			<div className="captcha-settings-content">
				<h3>
					{META.name}设置 <span>v{version}</span>
				</h3>

				<div className="settings-nav">
					{TABS.map((tab) => (
						<div
							key={tab.id}
							className={`settings-nav-item${activeTab === tab.id ? ' active' : ''}`}
							onClick={() => setActiveTab(tab.id)}
						>
							{tab.label}
						</div>
					))}
				</div>

				<div className="settings-content">
					{/* 服务商页始终挂载，切换标签页时保留已获取的模型列表和测试结果 */}
					<div className="settings-content-tab" hidden={activeTab !== 'ai'}>
						<ProviderTab draft={draft} update={update} />
					</div>
					{activeTab === 'function' && (
						<div className="settings-content-tab">
							<FunctionTab draft={draft} update={update} />
						</div>
					)}
					{activeTab === 'domain' && (
						<div className="settings-content-tab">
							<DomainTab draft={draft} update={update} />
						</div>
					)}
					{activeTab === 'advanced' && (
						<div className="settings-content-tab">
							<AdvancedTab draft={draft} update={update} ruleSet={ruleSet} reloadRules={reloadRules} />
						</div>
					)}
				</div>

				<div className="captcha-settings-buttons">
					<button type="button" onClick={save}>
						保存设置
					</button>
					<button type="button" onClick={onClose}>
						取消
					</button>
				</div>
			</div>
		</div>
	);
}
