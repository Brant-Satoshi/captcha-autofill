import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncStatus = '' | 'loading' | 'success' | 'error';

interface State {
	status: AsyncStatus;
	message: string;
}

const IDLE: State = { status: '', message: '' };

/**
 * 按钮的「加载中 / 成功 / 失败」状态。
 * run() 执行一个异步操作并更新状态，结束 3 秒后按钮恢复初始状态（提示文字保留）。
 * reset() 会作废还没返回的操作，它的结果不再更新状态。
 */
export function useAsyncStatus() {
	const [state, setState] = useState<State>(IDLE);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const running = useRef(false);
	/** 每次 reset 或卸载时递增，用来识别过期的操作 */
	const generation = useRef(0);

	useEffect(
		() => () => {
			generation.current++;
			clearTimeout(timer.current);
		},
		[]
	);

	const run = useCallback(async (task: () => Promise<string | void>) => {
		if (running.current) return;
		running.current = true;
		const current = generation.current;
		clearTimeout(timer.current);
		setState({ status: 'loading', message: '' });

		let next: State;
		try {
			next = { status: 'success', message: (await task()) || '' };
		} catch (error) {
			next = { status: 'error', message: (error as Error).message || '未知错误' };
		}

		if (generation.current !== current) return;
		running.current = false;
		setState(next);
		timer.current = setTimeout(() => setState((prev) => ({ ...prev, status: '' })), 3000);
	}, []);

	const reset = useCallback(() => {
		generation.current++;
		running.current = false;
		clearTimeout(timer.current);
		setState(IDLE);
	}, []);

	return { ...state, run, reset };
}
