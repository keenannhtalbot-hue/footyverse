// Settings app: save, export, import, reset, theme/accessibility toggles.

import { card } from './helpers.js';

export function render(container, { state, actions }) {
  const s = state.settings;

  container.innerHTML = `
    ${card(
      'Save data',
      `
      <div class="btn-row">
        <button type="button" class="btn btn--primary" id="save-btn">Save now</button>
        <button type="button" class="btn" id="export-btn">Export save (.json)</button>
        <button type="button" class="btn" id="import-btn">Import save</button>
      </div>
      <input type="file" id="import-file-input" accept="application/json" class="visually-hidden" />
      <p class="text-small text-dim mt-4">FootyVerse autosaves after every quarter and every action. Exporting downloads a JSON file you can keep as a backup or move to another browser.</p>
      `,
      { fullSpan: true }
    )}
    ${card(
      'Appearance',
      `
      <div class="form-field">
        <label id="theme-label">Theme</label>
        <div class="radio-group" role="radiogroup" aria-labelledby="theme-label">
          <label class="radio-chip"><input type="radio" name="theme" value="dark" ${s.theme === 'dark' ? 'checked' : ''} /> Dark</label>
          <label class="radio-chip"><input type="radio" name="theme" value="light" ${s.theme === 'light' ? 'checked' : ''} /> Light</label>
        </div>
      </div>
      <div class="checkbox-group">
        <label class="radio-chip"><input type="checkbox" id="high-contrast" ${s.highContrast ? 'checked' : ''} /> High contrast</label>
        <label class="radio-chip"><input type="checkbox" id="reduced-motion" ${s.reducedMotion ? 'checked' : ''} /> Reduce motion</label>
      </div>
      `
    )}
    ${card(
      'Danger zone',
      `
      <p class="text-small text-dim">Resetting permanently deletes your save from this browser.</p>
      <button type="button" class="btn btn--danger" id="reset-btn">Reset FootyVerse</button>
      `
    )}
  `;

  container.querySelector('#save-btn').addEventListener('click', () => actions.saveGame());

  container.querySelector('#export-btn').addEventListener('click', () => {
    const json = actions.exportGame();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `footyverse-save-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  const fileInput = container.querySelector('#import-file-input');
  container.querySelector('#import-btn').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const text = await file.text();
    actions.importGame(text);
  });

  container.querySelectorAll('input[name="theme"]').forEach((input) => {
    input.addEventListener('change', () => actions.updateSettings({ theme: input.value }));
  });
  container.querySelector('#high-contrast').addEventListener('change', (e) =>
    actions.updateSettings({ highContrast: e.target.checked })
  );
  container.querySelector('#reduced-motion').addEventListener('change', (e) =>
    actions.updateSettings({ reducedMotion: e.target.checked })
  );

  container.querySelector('#reset-btn').addEventListener('click', () => actions.resetGame());
}
