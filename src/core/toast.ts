export type ToastType = 'info' | 'success' | 'error' | 'warning';

const CONTAINER_ID = 'captcha-toast-container';

/** 在页面右上角显示一条 3 秒后消失的提示 */
export function showToast(message: string, type: ToastType = 'info'): void {
	let container = document.getElementById(CONTAINER_ID);
	if (!container) {
		container = document.createElement('div');
		container.id = CONTAINER_ID;
		document.documentElement.appendChild(container);
	}

	const toast = document.createElement('div');
	toast.className = `captcha-toast captcha-toast-${type}`;
	toast.textContent = message;
	container.prepend(toast);

	setTimeout(() => toast.classList.add('captcha-toast-show'), 10);
	setTimeout(() => {
		toast.classList.remove('captcha-toast-show');
		toast.classList.add('captcha-toast-hide');
		setTimeout(() => toast.remove(), 300);
	}, 3000);
}
