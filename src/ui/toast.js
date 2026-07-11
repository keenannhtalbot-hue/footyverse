// Lightweight toast notifications. UI-only.

export function showToast(text, { timeout = 4200 } = {}) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.textContent = text;
  region.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, timeout);
}
