import { createRoot } from 'react-dom/client';
import { App } from './App';
import './assets/app.less';
import { startApp } from './state';

// 挂在 <html> 下而不是 <body> 里，避免被页面脚本整体替换 body 时带走
const host = document.createElement('div');
document.documentElement.append(host);
createRoot(host).render(<App />);

startApp();
