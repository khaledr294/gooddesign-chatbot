import { render } from 'preact';
import { Widget } from './Widget';

// Auto-mount widget when script loads
function init() {
  const container = document.createElement('div');
  container.id = 'gooddesign-chat-widget';
  document.body.appendChild(container);

  const serverUrl =
    (document.currentScript as HTMLScriptElement)?.getAttribute('data-server') ||
    'https://chat.gddsn.com';

  render(<Widget serverUrl={serverUrl} />, container);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
