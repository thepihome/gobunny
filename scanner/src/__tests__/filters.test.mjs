import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTitleFilter, buildLocationFilter, applyFilters } from '../filters.js';

test('buildTitleFilter requires positive match and rejects negatives', () => {
  const filter = buildTitleFilter({
    positive: ['engineer'],
    negative: ['intern'],
  });
  assert.equal(filter('Senior Software Engineer'), true);
  assert.equal(filter('Software Intern'), false);
  assert.equal(filter('Product Manager'), false);
});

test('buildTitleFilter passes all when positive empty', () => {
  const filter = buildTitleFilter({ positive: [], negative: ['intern'] });
  assert.equal(filter('Any Role'), true);
  assert.equal(filter('Intern'), false);
});

test('buildLocationFilter blocks and allows', () => {
  const filter = buildLocationFilter({
    allow: ['remote', 'united states'],
    block: ['india'],
  });
  assert.equal(filter('Remote, US'), true);
  assert.equal(filter('Bengaluru, India'), false);
  assert.equal(filter(''), true);
});

test('applyFilters aggregates counts', () => {
  const jobs = [
    { title: 'AI Engineer', location: 'Remote' },
    { title: 'Intern AI', location: 'Remote' },
    { title: 'Engineer', location: 'India' },
  ];
  const { jobs: out, filteredTitle, filteredLocation } = applyFilters(jobs, {
    titleFilter: { positive: ['engineer'], negative: ['intern'] },
    locationFilter: { block: ['india'] },
  });
  assert.equal(out.length, 1);
  assert.equal(filteredTitle, 1);
  assert.equal(filteredLocation, 1);
});
