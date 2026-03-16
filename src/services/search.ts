import * as queries from '../database/queries.js';
import type { RecallInput, RecallOutput, SearchInput, SearchOutput } from '../types/index.js';

// Resource limits
const MAX_FETCH_MEMORIES = 5000;

export function recallMemories(input: RecallInput): RecallOutput {
  const { query, limit = 10, tags, date_range } = input;

  if (!query || query.trim().length === 0) {
    throw new Error('Query is required');
  }

  // Use FTS for keyword search
  const results = queries.searchMemoriesFTS(query, limit, tags);

  // Apply date range filter in memory (FTS results don't easily support date filtering in SQL)
  let filteredResults = results;
  if (date_range) {
    filteredResults = filteredResults.filter(m => {
      const createdAt = new Date(m.created_at);
      if (date_range.start && createdAt < new Date(date_range.start)) {
        return false;
      }
      if (date_range.end && createdAt > new Date(date_range.end)) {
        return false;
      }
      return true;
    });
  }

  // Transform results - use optimized query to get tags with JOIN
  const transformedResults = filteredResults.map(m => {
    // BM25 returns negative scores, convert to positive relevance (0-1)
    // Lower (more negative) BM25 = better match, so we invert
    const relevanceScore = Math.max(0, Math.min(1, 1 / (1 + Math.abs(m.rank || 0))));

    return {
      memory_id: m.id,
      content: m.content,
      tags: m.tags || [],
      relevance_score: relevanceScore,
      created_at: m.created_at,
      updated_at: m.updated_at,
    };
  });

  return {
    success: true,
    results: transformedResults,
    total: transformedResults.length,
  };
}

export function searchMemories(input: SearchInput): SearchOutput {
  const {
    query,
    tags,
    date_range,
    sort_by = 'date_desc',
    limit = 10,
    offset = 0,
  } = input;

  // Enforce maximum fetch limit
  const effectiveLimit = Math.min(limit, MAX_FETCH_MEMORIES - offset);

  let memories;

  if (query && query.trim().length > 0) {
    // Use FTS search
    const results = queries.searchMemoriesFTS(query, effectiveLimit * 2, tags);
    memories = results.map(m => ({
      ...m,
      tags: m.tags || [],
    }));
  } else if (tags && tags.length > 0) {
    // Use optimized SQL JOIN query instead of loading 5000 rows
    if (date_range && (date_range.start || date_range.end)) {
      // When date range is specified, filter by date first, then tags
      const memoriesWithDate = queries.getMemoriesWithTagsAndDateFilter(
        date_range.start,
        date_range.end,
        MAX_FETCH_MEMORIES
      );
      memories = memoriesWithDate.filter(m => {
        if (!m.tags) return false;
        return tags.every(t => m.tags!.includes(t.toLowerCase()));
      });
    } else {
      // Use SQL JOIN to filter by tags - much more efficient
      memories = queries.getMemoriesByTags(tags, MAX_FETCH_MEMORIES);
    }
  } else if (date_range && (date_range.start || date_range.end)) {
    // Use optimized query with date filter in SQL
    memories = queries.getMemoriesWithTagsAndDateFilter(
      date_range.start,
      date_range.end,
      MAX_FETCH_MEMORIES
    );
  } else {
    // Get all memories with limit
    memories = queries.getAllMemoriesLimited(MAX_FETCH_MEMORIES);
  }

  // Sort (if not already sorted by SQL)
  if (sort_by === 'date_asc') {
    memories.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  } else if (sort_by === 'date_desc') {
    memories.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // Apply pagination
  const total = memories.length;
  const paginatedMemories = memories.slice(offset, offset + limit);

  return {
    success: true,
    memories: paginatedMemories.map(m => ({
      id: m.id,
      content: m.content,
      tags: m.tags || [],
      created_at: m.created_at,
      updated_at: m.updated_at,
    })),
    pagination: {
      total,
      limit,
      offset,
      has_more: offset + limit < total,
    },
  };
}
