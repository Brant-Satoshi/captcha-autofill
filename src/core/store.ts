/**
 * 一个很小的状态容器：页面行为（控制器）和界面（React）都从这里读写状态。
 * React 侧通过 useSyncExternalStore 订阅。
 */
export interface Store<T> {
	get(): T;
	set(patch: Partial<T>): void;
	subscribe(listener: () => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
	let state = initial;
	const listeners = new Set<() => void>();
	return {
		get: () => state,
		set(patch) {
			state = { ...state, ...patch };
			listeners.forEach((listener) => listener());
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
	};
}
