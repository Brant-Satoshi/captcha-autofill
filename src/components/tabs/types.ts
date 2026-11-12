import type { Settings } from '../../core/settings';

/** 各标签页共用的属性：正在编辑的设置副本，以及修改它的方法 */
export interface TabProps {
	draft: Settings;
	update: (patch: Partial<Settings>) => void;
}
