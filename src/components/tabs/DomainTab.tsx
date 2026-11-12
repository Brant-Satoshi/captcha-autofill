import type { TabProps } from './types';

const PLACEHOLDER = `每行一个域名，支持通配符和正则，例如：
example.com
*.example.org
/^(www\\.)?example\\.com$/`;

/** 「禁用域名」标签页 */
export function DomainTab({ draft, update }: TabProps) {
	const hostname = location.hostname;
	const listed = draft.disabledDomains
		.split('\n')
		.map((line) => line.trim())
		.includes(hostname);

	const addCurrentHost = () =>
		update({ disabledDomains: [draft.disabledDomains.trim(), hostname].filter(Boolean).join('\n') });

	return (
		<div className="settings-card">
			<div className="settings-card-title">
				<span>禁用域名列表</span>
			</div>
			<div className="captcha-settings-item">
				<textarea
					className="domain-textarea"
					value={draft.disabledDomains}
					placeholder={PLACEHOLDER}
					rows={6}
					spellCheck={false}
					onChange={(event) => update({ disabledDomains: event.target.value })}
				/>
				<small>在这些域名下不启用验证码识别，每行一项</small>
			</div>
			<div className="captcha-settings-item">
				<button type="button" className="add-selector" disabled={listed} onClick={addCurrentHost}>
					{listed ? `当前网站已在列表中（${hostname}）` : `添加当前网站（${hostname}）`}
				</button>
			</div>
		</div>
	);
}
