import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  filterByDateRange,
  autoGranularity,
  aggregateByTime,
  aggregateBySession,
  aggregateByProject,
  aggregateByModel,
  aggregateCache,
} from '../server/aggregator.js';

const sampleRecords = [
  { sessionId: 's1', timestamp: '2026-03-10T10:00:00.000Z', model: 'claude-sonnet-4-6', project: 'proj-a', input_tokens: 1000, output_tokens: 500, cache_read_tokens: 200, cache_creation_tokens: 100 },
  { sessionId: 's1', timestamp: '2026-03-10T11:00:00.000Z', model: 'claude-sonnet-4-6', project: 'proj-a', input_tokens: 2000, output_tokens: 800, cache_read_tokens: 500, cache_creation_tokens: 200 },
  { sessionId: 's2', timestamp: '2026-03-11T14:00:00.000Z', model: 'claude-opus-4-6', project: 'proj-b', input_tokens: 5000, output_tokens: 1000, cache_read_tokens: 1000, cache_creation_tokens: 500 },
];

describe('filterByDateRange', () => {
  it('filters records within date range (inclusive)', () => {
    const filtered = filterByDateRange(sampleRecords, '2026-03-10', '2026-03-10');
    expect(filtered).to.have.length(2);
  });

  it('returns all records if no dates specified', () => {
    const filtered = filterByDateRange(sampleRecords);
    expect(filtered).to.have.length(3);
  });
});

describe('autoGranularity', () => {
  it('returns hourly for ≤2 day range', () => {
    expect(autoGranularity('2026-03-10', '2026-03-11')).to.equal('hourly');
  });

  it('returns daily for ≤14 day range', () => {
    expect(autoGranularity('2026-03-01', '2026-03-10')).to.equal('daily');
  });

  it('returns weekly for ≤60 day range', () => {
    expect(autoGranularity('2026-01-01', '2026-02-15')).to.equal('weekly');
  });

  it('returns monthly for >60 day range', () => {
    expect(autoGranularity('2025-01-01', '2026-03-10')).to.equal('monthly');
  });
});

describe('aggregateByTime', () => {
  it('aggregates records into daily buckets', () => {
    const buckets = aggregateByTime(sampleRecords, 'daily');
    expect(buckets).to.have.length(2);
    expect(buckets[0].time).to.equal('2026-03-10');
    expect(buckets[0].input_tokens).to.equal(3000);
    expect(buckets[0].output_tokens).to.equal(1300);
  });
});

describe('aggregateBySession', () => {
  it('groups records by sessionId with totals', () => {
    const sessions = aggregateBySession(sampleRecords);
    expect(sessions).to.have.length(2);
    const s1 = sessions.find(s => s.sessionId === 's1');
    expect(s1.input_tokens).to.equal(3000);
    expect(s1.models).to.include('claude-sonnet-4-6');
    expect(s1.project).to.equal('proj-a');
  });
});

describe('aggregateByProject', () => {
  it('groups records by project', () => {
    const projects = aggregateByProject(sampleRecords);
    expect(projects).to.have.length(2);
    const projA = projects.find(p => p.name === 'proj-a');
    // total_tokens = input(3000) + output(1300) + cache_read(700) + cache_creation(300) = 5300
    expect(projA.total_tokens).to.equal(5300);
  });
});

describe('aggregateByModel', () => {
  it('groups records by model', () => {
    const models = aggregateByModel(sampleRecords);
    expect(models).to.have.length(2);
  });
});

describe('aggregateCache', () => {
  it('computes cache efficiency rates', () => {
    const cache = aggregateCache(sampleRecords);
    // allInput = nonCached(8000) + cacheRead(1700) + cacheCreation(800) = 10500
    expect(cache.total_input_tokens).to.equal(10500);
    expect(cache.cache_read_tokens).to.equal(1700);
    expect(cache.cache_read_rate).to.be.a('number');
  });
});
