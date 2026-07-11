// Generic accessible modal dialog helper built on the native <dialog>
// element. UI-only: no game-rule logic lives here.

let dialogRoot = null;

function getRoot() {
  if (!dialogRoot) {
    dialogRoot = document.getElementById('dialog-root');
  }
  return dialogRoot;
}

/**
 * Opens a modal dialog and resolves with the id of the button pressed,
 * or null if dismissed (Esc / backdrop / close button).
 *
 * @param {{title:string, bodyHtml:string, actions:{id:string,label:string,variant?:string}[], labelledBy?:string}} opts
 */
export function openDialog({ title, bodyHtml, actions }) {
  return new Promise((resolve) => {
    const root = getRoot();
    const dlg = document.createElement('dialog');
    dlg.setAttribute('aria-labelledby', 'dlg-title');

    const actionsHtml = actions
      .map(
        (a) =>
          `<button type="button" class="btn ${a.variant ? `btn--${a.variant}` : ''}" data-action="${a.id}">${escapeHtml(a.label)}</button>`
      )
      .join('');

    dlg.innerHTML = `
      <div class="dialog-body">
        <h2 id="dlg-title">${escapeHtml(title)}</h2>
        <div class="dialog-content">${bodyHtml}</div>
        <div class="dialog-actions">${actionsHtml}</div>
      </div>
    `;

    root.appendChild(dlg);

    function cleanup(result) {
      dlg.removeEventListener('close', onClose);
      dlg.remove();
      resolve(result);
    }

    function onClose() {
      cleanup(null);
    }

    dlg.addEventListener('close', onClose);
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) {
        dlg.close();
      }
    });

    dlg.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-action');
        dlg.removeEventListener('close', onClose);
        dlg.close();
        dlg.remove();
        resolve(id);
      });
    });

    dlg.showModal();
    const firstBtn = dlg.querySelector('button[data-action]');
    if (firstBtn) firstBtn.focus();
  });
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
