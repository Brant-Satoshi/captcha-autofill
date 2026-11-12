import type { Settings } from '../../core/settings';
import type { TabProps } from './types';

/** 值为布尔类型的设置项 */
type ToggleKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

const TOGGLES: { key: ToggleKey; label: string }[] = [
	{ key: 'autoRecognize', label: '验证码图片出现或变化时自动识别' },
	{ key: 'copyToClipboard', label: '识别后自动复制到剪贴板' },
	{ key: 'showNotification', label: '显示右上角通知提示' },
	{ key: 'autoFetchRules', label: '每天首次运行时自动获取远程规则' },
];

/** 「功能设置」标签页：几个开关 */
export function FunctionTab({ draft, update }: TabProps) {
	return (
		<div className="settings-card">
			<div className="settings-card-title">
				<span>功能设置</span>
			</div>
			{TOGGLES.map(({ key, label }) => (
				<label key={key} className="check-row">
					<input type="checkbox" checked={draft[key]} onChange={(event) => update({ [key]: event.target.checked })} />
					<span>{label}</span>
				</label>
			))}
		</div>
	);
}
