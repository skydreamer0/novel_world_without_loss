export function initErrorBoundary() {
  window.onerror = function (message, source, lineno, colno, error) {
    console.error('[ErrorBoundary] 未捕獲的錯誤:', message, source, lineno, colno, error);
    showError('系統發生未知錯誤，部分功能可能無法使用');
    return true;
  };

  window.addEventListener('unhandledrejection', function (event) {
    console.error('[ErrorBoundary] 未處理的 Promise 拒絕:', event.reason);
  });
}

export function showError(message, recoveryHint) {
  const existing = document.getElementById('error-boundary-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'error-boundary-toast';
  toast.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: 0',
    'right: 0',
    'z-index: 99999',
    'background: #dc3545',
    'color: #fff',
    'padding: 12px 24px',
    'text-align: center',
    'font-size: 14px',
    'font-family: sans-serif',
    'box-shadow: 0 2px 8px rgba(0,0,0,0.25)',
    'cursor: pointer',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'gap: 12px',
    'line-height: 1.4',
  ].join(';');

  const msgSpan = document.createElement('span');
  msgSpan.textContent = message;
  toast.appendChild(msgSpan);

  if (recoveryHint) {
    const hintSpan = document.createElement('span');
    hintSpan.style.cssText = 'text-decoration: underline; font-weight: bold;';
    hintSpan.textContent = recoveryHint;
    toast.appendChild(hintSpan);
  }

  toast.addEventListener('click', function () {
    toast.remove();
  });

  document.body.prepend(toast);

  setTimeout(function () {
    if (document.body.contains(toast)) {
      toast.remove();
    }
  }, 8000);
}

export async function wrapModule(moduleName, fn) {
  try {
    return await fn();
  } catch (err) {
    console.error('[ErrorBoundary] 模組 "' + moduleName + '" 載入失敗:', err);
    showError(moduleName + ' 載入失敗，部分功能可能無法使用');
    return null;
  }
}
