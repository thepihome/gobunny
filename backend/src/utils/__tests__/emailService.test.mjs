import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { renderTemplate } from '../emailService.js';
import { EMAIL_ACTION_IDS, defaultEmailConfig } from '../emailConstants.js';

describe('renderTemplate', () => {
  it('replaces variables with values', () => {
    const out = renderTemplate('Hello {{first_name}} {{last_name}}', {
      first_name: 'Ada',
      last_name: 'Lovelace',
    });
    assert.equal(out, 'Hello Ada Lovelace');
  });

  it('allows spaces inside braces', () => {
    const out = renderTemplate('{{ first_name }}', { first_name: 'Test' });
    assert.equal(out, 'Test');
  });

  it('replaces missing variables with empty string', () => {
    const out = renderTemplate('Hi {{missing}}', {});
    assert.equal(out, 'Hi ');
  });
});

describe('defaultEmailConfig', () => {
  it('includes all action templates', () => {
    const config = defaultEmailConfig();
    for (const id of EMAIL_ACTION_IDS) {
      assert.ok(config.templates[id]?.subject, `missing subject for ${id}`);
      assert.ok(config.templates[id]?.body_text, `missing body_text for ${id}`);
    }
  });
});
