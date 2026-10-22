import './styles/main.css';
import { GameApp } from './core/GameApp';

declare global {
  interface Window {
    __BLACKLINE_GAME__?: GameApp;
  }
}

function bootstrap(): void {
  const viewportEl = document.getElementById('viewport');
  const uiRootEl = document.getElementById('ui-root');
  if (!viewportEl || !uiRootEl) {
    throw new Error('Missing #viewport or #ui-root container elements.');
  }

  const app = new GameApp(viewportEl, uiRootEl);
  window.__BLACKLINE_GAME__ = app;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
