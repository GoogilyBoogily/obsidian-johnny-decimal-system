import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePath, isExcluded} from '../src/core/exclusions';

test('normalizePath strips/collapses slashes', () => {
	assert.equal(normalizePath('/a//b/'), 'a/b');
	assert.equal(normalizePath('a/b'), 'a/b');
	assert.equal(normalizePath('///'), '');
});

test('exact path match', () => {
	const ex = ['30-39 Knowledge/35 Web/35.00 Karakeep'];
	assert.equal(isExcluded('30-39 Knowledge/35 Web/35.00 Karakeep', ex), true);
	assert.equal(isExcluded('30-39 Knowledge/35 Web/35.01 Other', ex), false);
});

test('subtree-inclusive: folder excludes all descendants', () => {
	const ex = ['70-79 Journals/72 Daily Tracking'];
	assert.equal(isExcluded('70-79 Journals/72 Daily Tracking', ex), true);
	assert.equal(
		isExcluded('70-79 Journals/72 Daily Tracking/2026/2026-05-15.md', ex),
		true
	);
	assert.equal(isExcluded('70-79 Journals/72 Daily', ex), false); // not a path-segment prefix
});

test('no false prefix match on partial segment', () => {
	const ex = ['10-19 Life'];
	assert.equal(isExcluded('10-19 Life admin', ex), false);
	assert.equal(isExcluded('10-19 Life', ex), true);
	assert.equal(isExcluded('10-19 Life/sub', ex), true);
});

test('glob: ** across segments, * within segment', () => {
	assert.equal(isExcluded('a/b/c.excalidraw', ['**/*.excalidraw']), true);
	assert.equal(isExcluded('top.excalidraw', ['**/*.excalidraw']), true);
	assert.equal(isExcluded('a/templates/x', ['**/templates/**']), true);
	assert.equal(isExcluded('a/b/note.md', ['*.md']), false); // * does not cross /
	assert.equal(isExcluded('note.md', ['*.md']), true);
});

test('regex specials in real folder names are literal', () => {
	const ex = ['30-39 K/35 Web/35.00 Karakeep'];
	assert.equal(isExcluded('30-39 K/35 Web/35.00 Karakeep', ex), true);
	// the '.' must not act as regex any-char
	assert.equal(isExcluded('30-39 K/35 Web/35X00 Karakeep', ex), false);
});

test('empty exclusions / empty entries', () => {
	assert.equal(isExcluded('a/b', []), false);
	assert.equal(isExcluded('a/b', ['', '   ']), false);
});
