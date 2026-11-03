import 'dotenv/config';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseHeaderYears, findBestHeader } from '../src/services/sync-rosters.js';

describe('sync-rosters domain & matching logic', () => {
  const sampleHeaders = [
    'Barcelona 1991-92',
    'Barcelona 2005-06',
    'Barcelona 2008-09',
    'Barcelona 2010-11',
    'Barcelona 2014-15',
    'Real Madrid 1956-1960',
    'Real Madrid 2000-2002',
    'Real Madrid 2014-2018',
    'Milan 1962-63',
    'Milan 2006-07',
    'Inter 1997-98',
    'Inter 2009-10',
    'Chelsea 2011-12',
    'Chelsea 2020-21',
    'River Plate 2014-2015',
    'River Plate 2018',
    'Boca Jrs. 2000-2001',
    'Boca Jrs. 2007',
  ];

  test('parseHeaderYears extracts year ranges correctly', () => {
    assert.deepEqual(parseHeaderYears('Barcelona 2014-15'), { start: 2014, end: 2015 });
    assert.deepEqual(parseHeaderYears('Real Madrid 1956-1960'), { start: 1956, end: 1960 });
    assert.deepEqual(parseHeaderYears('Milan 1962-63'), { start: 1962, end: 1963 });
    assert.deepEqual(parseHeaderYears('Argentina 2022'), { start: 2022, end: 2022 });
  });

  test('distingue distintos Barcelona segun el año exacto', () => {
    assert.equal(findBestHeader('Barcelona 2014', sampleHeaders), 'Barcelona 2014-15');
    assert.equal(findBestHeader('Barcelona 2014-15', sampleHeaders), 'Barcelona 2014-15');
    assert.equal(findBestHeader('Barcelona 2009', sampleHeaders), 'Barcelona 2008-09');
    assert.equal(findBestHeader('Barcelona 2008-09', sampleHeaders), 'Barcelona 2008-09');
    assert.equal(findBestHeader('Barcelona 2006', sampleHeaders), 'Barcelona 2005-06');
    assert.equal(findBestHeader('Barcelona 1992', sampleHeaders), 'Barcelona 1991-92');
  });

  test('distingue distintos Real Madrid segun el año exacto', () => {
    assert.equal(findBestHeader('Real Madrid 2002', sampleHeaders), 'Real Madrid 2000-2002');
    assert.equal(findBestHeader('Real Madrid 2017', sampleHeaders), 'Real Madrid 2014-2018');
    assert.equal(findBestHeader('Real Madrid 1958', sampleHeaders), 'Real Madrid 1956-1960');
  });

  test('distingue Inter y Milan sin cruzarlos', () => {
    assert.equal(findBestHeader('Inter 2010', sampleHeaders), 'Inter 2009-10');
    assert.equal(findBestHeader('Milan 2007', sampleHeaders), 'Milan 2006-07');
  });

  test('distingue River Plate y Boca Juniors segun sus ediciones historicas', () => {
    assert.equal(findBestHeader('River Plate 2018', sampleHeaders), 'River Plate 2018');
    assert.equal(findBestHeader('River Plate 2015', sampleHeaders), 'River Plate 2014-2015');
    assert.equal(findBestHeader('Boca Jrs 2000', sampleHeaders), 'Boca Jrs. 2000-2001');
    assert.equal(findBestHeader('Boca Jrs 2007', sampleHeaders), 'Boca Jrs. 2007');
  });
});
