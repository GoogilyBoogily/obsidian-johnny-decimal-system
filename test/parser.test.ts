import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
	isValidSystemCode,
	parseSystem,
	parseArea,
	parseCategory,
	parseId,
	isValidAreaRange,
	isCategoryInArea,
	isIdInCategory,
	sanitizeName,
	formatSystemName,
	formatAreaName,
	formatCategoryName,
	formatIdName,
	formatFullId,
} from '../src/core/parser';

test('isValidSystemCode', () => {
	assert.equal(isValidSystemCode('H01'), true);
	assert.equal(isValidSystemCode('W99'), true);
	assert.equal(isValidSystemCode('h01'), false);
	assert.equal(isValidSystemCode('H1'), false);
	assert.equal(isValidSystemCode('HH1'), false);
	assert.equal(isValidSystemCode('H01 Personal'), false);
});

test('parseSystem', () => {
	assert.deepEqual(parseSystem('H01 Personal'), {code: 'H01', name: 'Personal'});
	assert.deepEqual(parseSystem('C02 Client Work'), {
		code: 'C02',
		name: 'Client Work',
	});
	assert.equal(parseSystem('Personal'), null);
	assert.equal(parseSystem('10-19 Life admin'), null);
});

test('parseArea — clean names, no system prefix', () => {
	assert.deepEqual(parseArea('10-19 Life admin'), {
		system: null,
		rangeStart: 10,
		rangeEnd: 19,
		name: 'Life admin',
	});
	assert.equal(parseArea('H01.10-19 Life admin'), null);
	assert.equal(parseArea('11 Travel'), null);
});

test('parseCategory', () => {
	assert.deepEqual(parseCategory('11 Travel'), {
		system: null,
		number: 11,
		name: 'Travel',
	});
	assert.equal(parseCategory('10-19 Life admin'), null);
	assert.equal(parseCategory('11.01 NYC'), null);
});

test('parseId — strips .md, parses XX.YY', () => {
	assert.deepEqual(parseId('11.01 NYC Trip.md'), {
		system: null,
		category: 11,
		id: 1,
		name: 'NYC Trip',
	});
	assert.deepEqual(parseId('11.01 NYC Trip'), {
		system: null,
		category: 11,
		id: 1,
		name: 'NYC Trip',
	});
	assert.equal(parseId('11 Travel'), null);
});

test('isValidAreaRange', () => {
	assert.equal(isValidAreaRange(10, 19), true);
	assert.equal(isValidAreaRange(0, 9), true);
	assert.equal(isValidAreaRange(90, 99), true);
	assert.equal(isValidAreaRange(10, 18), false);
	assert.equal(isValidAreaRange(11, 20), false);
	assert.equal(isValidAreaRange(90, 100), false);
});

test('isCategoryInArea / isIdInCategory', () => {
	const area = {system: null, rangeStart: 10, rangeEnd: 19, name: 'x'};
	assert.equal(isCategoryInArea(10, area), true);
	assert.equal(isCategoryInArea(19, area), true);
	assert.equal(isCategoryInArea(20, area), false);
	assert.equal(isIdInCategory(11, 11), true);
	assert.equal(isIdInCategory(12, 11), false);
});

test('sanitizeName strips path-illegal chars', () => {
	// 8 illegal chars: / : * ? " < > |
	assert.equal(sanitizeName('a/b:c*?"<>|'), 'a-b-c------');
	assert.equal(sanitizeName('  Trip  '), 'Trip');
});

test('formatters are zero-padded and clean', () => {
	assert.equal(formatSystemName('H01', 'Personal'), 'H01 Personal');
	assert.equal(formatAreaName(10, 'Life admin'), '10-19 Life admin');
	assert.equal(formatAreaName(0, 'Meta'), '00-09 Meta');
	assert.equal(formatCategoryName(1, 'Travel'), '01 Travel');
	assert.equal(formatIdName(11, 1, 'NYC'), '11.01 NYC');
	assert.equal(formatFullId(11, 1), '11.01');
	assert.equal(formatFullId(11, 1, 'H01'), 'H01.11.01');
	assert.equal(formatFullId(11, 1, null), '11.01');
});

test('parse/format round-trips', () => {
	const a = parseArea(formatAreaName(30, 'Knowledge'));
	assert.equal(a?.rangeStart, 30);
	const c = parseCategory(formatCategoryName(35, 'Web'));
	assert.equal(c?.number, 35);
	const i = parseId(`${formatIdName(35, 4, 'Karakeep')}.md`);
	assert.equal(i?.category, 35);
	assert.equal(i?.id, 4);
});
