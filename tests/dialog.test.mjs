import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDialog } from '../src/ui/dialog.js';

function makeDialogDocument() {
  const appended = [];
  const dialog = {
    id: '',
    innerHTML: '',
    setAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    remove() {},
    querySelectorAll() { return []; },
    querySelector() { return { focus() {} }; },
    showModal() {},
    close() {},
  };
  const root = { appendChild(node) { appended.push(node); } };
  return {
    appended,
    document: {
      getElementById() { return root; },
      createElement() { return dialog; },
    },
  };
}

test('openDialog assigns the requested id so aria-controls can target the live dialog', () => {
  const { appended, document } = makeDialogDocument();
  globalThis.document = document;
  openDialog({
    id: 'quarter-review-dialog',
    title: 'Your quarter so far',
    bodyHtml: '<p>Highlights</p>',
    actions: [{ id: 'close', label: 'Close' }],
  });

  assert.equal(appended.length, 1);
  assert.equal(appended[0].id, 'quarter-review-dialog');
  delete globalThis.document;
});
