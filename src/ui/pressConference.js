// Press-conference flow — small, accessible dialog payload + a pure
// renderer the senior-epilogue card uses to render the recorded
// conferences. Story-only: limited to existing canonical effects
// (relationship.adjustments, quarterEvidence append, coach memory
// via addMemory). No invented stats, no fabricated media coverage.

import { escapeHtml } from './helpers.js';

const CHOICES_BY_MILESTONE = Object.freeze({
  'transfer-accepted': Object.freeze([
    {
      id: 'professional',
      label: 'I am here to work hard and earn my place.',
      effects: {
        confidenceDelta: 1,
        relationshipTargetId: 'coach',
        relationshipDelta: 0.05,
        memoryWeight: 2,
      },
    },
    {
      id: 'gracious',
      label: 'I am grateful to the club and the supporters.',
      effects: {
        confidenceDelta: 0,
        relationshipTargetId: 'coach',
        relationshipDelta: 0.10,
        memoryWeight: 2,
      },
    },
    {
      id: 'ambitious',
      label: 'I want to win trophies here.',
      effects: {
        confidenceDelta: 2,
        relationshipTargetId: 'coach',
        relationshipDelta: -0.02,
        memoryWeight: 1,
      },
    },
  ]),
  'contract-accepted': Object.freeze([
    {
      id: 'professional',
      label: 'I am here to work hard and earn my place.',
      effects: {
        confidenceDelta: 1,
        relationshipTargetId: 'coach',
        relationshipDelta: 0.05,
        memoryWeight: 2,
      },
    },
    {
      id: 'gracious',
      label: 'I am grateful to the club and the supporters.',
      effects: {
        confidenceDelta: 0,
        relationshipTargetId: 'coach',
        relationshipDelta: 0.10,
        memoryWeight: 2,
      },
    },
    {
      id: 'ambitious',
      label: 'I want to win trophies here.',
      effects: {
        confidenceDelta: 2,
        relationshipTargetId: 'coach',
        relationshipDelta: -0.02,
        memoryWeight: 1,
      },
    },
  ]),
  'post-expiry': Object.freeze([
    {
      id: 'reflective',
      label: 'It is a chapter closing — I will keep improving and see what comes next.',
      effects: {
        confidenceDelta: 0,
        relationshipTargetId: 'coach',
        relationshipDelta: 0.02,
        memoryWeight: 1,
      },
    },
    {
      id: 'determined',
      label: 'My phone is on. I want a club that wants me.',
      effects: {
        confidenceDelta: 1,
        relationshipTargetId: 'coach',
        relationshipDelta: 0,
        memoryWeight: 1,
      },
    },
    {
      id: 'patient',
      label: 'I will wait for the right move. No panic.',
      effects: {
        confidenceDelta: 0,
        relationshipTargetId: 'coach',
        relationshipDelta: 0.04,
        memoryWeight: 1,
      },
    },
  ]),
});

const QUESTIONS = Object.freeze({
  'transfer-accepted': 'You step up to the press conference podium for the first time. The room is full of cameras. What do you say?',
  'contract-accepted': 'You sign your first professional contract and the local paper asks for a few words. What do you say?',
  'post-expiry': 'Your contract has ended and the reporters want a quote. What do you say?',
});

function choicesFor(milestone) {
  return CHOICES_BY_MILESTONE[milestone] ?? CHOICES_BY_MILESTONE['post-expiry'];
}

function questionFor(milestone) {
  return QUESTIONS[milestone] ?? QUESTIONS['post-expiry'];
}

export function getPressConferenceChoices(milestone) {
  return choicesFor(milestone).slice();
}

export function getPressConferenceQuestion(milestone) {
  return questionFor(milestone);
}

// Pure: builds the dialog payload for a given milestone + (optional)
// contextual fields. Used by main.js's openDialog call.
export function buildPressConferenceDialog({ milestone, playerName, clubName, ledgerEventId }) {
  const question = questionFor(milestone);
  const safePlayer = escapeHtml(playerName ?? 'The player');
  const safeClub = escapeHtml(clubName ?? 'your new club');
  const body = `<p><strong>${safePlayer}</strong> faces the press after ${escapeHtml(milestone.replace(/-/g, ' '))} at <strong>${safeClub}</strong>.</p>`
    + `<p>${escapeHtml(question)}</p>`
    + `<p class="text-dim text-small">Reference: ${escapeHtml(String(ledgerEventId ?? ''))}</p>`;
  return {
    title: `${safePlayer} faces the press`,
    bodyHtml: body,
    actions: choicesFor(milestone).map((choice) => ({
      id: choice.id,
      label: choice.label,
      variant: choice.id === 'professional' ? 'primary' : undefined,
    })),
  };
}

// Pure: render the recorded press-conference list as a card fragment.
// The card is "content-only" so it slots into the senior-epilogue
// container which already renders the section heading + aria labels.
//
// Empty state: returns a single-line honest "No press conferences
// recorded yet" so the card always renders something truthful.
export function renderPressConferenceList(careerState, { playerName } = {}) {
  const records = Array.isArray(careerState?.pressConferences)
    ? careerState.pressConferences
    : [];
  if (records.length === 0) {
    return `<p class="text-dim text-small senior-epilogue__press-empty">No press conferences recorded yet.</p>`;
  }
  const newest = records.slice().sort((left, right) => {
    if (Number.isFinite(left?.tick) && Number.isFinite(right?.tick)) {
      return right.tick - left.tick;
    }
    return String(right?.id ?? '').localeCompare(String(left?.id ?? ''));
  });
  const items = newest.map((record) => {
    const when = Number.isFinite(record.tick) ? `Tick ${record.tick}` : '';
    const label = record.choiceLabel ? escapeHtml(record.choiceLabel) : 'No quote recorded';
    const question = record.question ? escapeHtml(record.question) : '';
    return `<li class="senior-epilogue__press-item">
      <strong>${escapeHtml(when || 'Recorded')}</strong>
      ${question ? `<div class="text-dim text-small">${question}</div>` : ''}
      <div>${label}</div>
    </li>`;
  }).join('');
  return `<ul class="senior-epilogue__list senior-epilogue__press-list" aria-label="Press conferences for ${escapeHtml(playerName ?? 'the player')}">${items}</ul>`;
}

// Pure: build a single-record payload for recordPressConference + the
// canonical-effect side-effects (relationship.adjustments + addMemory).
// Returns an effects object the caller can apply imperatively to
// state.relationships.coach and the ledger tick.
//
// `confidenceDelta` is permitted because the existing coach memory helper
// already records numeric weight — we keep it as a record-only annotation
// in the press record itself (no new player field).
export function buildPressConferenceRecord({ milestone, ledgerEventId, choiceId, tick, playerName, clubName }) {
  const choice = choicesFor(milestone).find((entry) => entry.id === choiceId)
    ?? choicesFor(milestone)[0];
  const question = questionFor(milestone);
  return {
    milestone,
    ledgerEventId,
    choiceId: choice.id,
    choiceLabel: choice.label,
    tick,
    question,
    effects: choice.effects,
    playerName,
    clubName,
  };
}
