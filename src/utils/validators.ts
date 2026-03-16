import type {
  RememberInput,
  RecallInput,
  SearchInput,
  RollbackInput,
  CreateCheckpointInput,
  DeleteMemoryInput,
} from '../types/index.js';

// Constants for limits
const MAX_QUERY_LENGTH = 1000;
const MAX_TAG_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_OFFSET = 10000;
const MAX_LIMIT = 1000;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

export function validateRememberInput(input: unknown): RememberInput {
  const args = input as RememberInput;

  if (!args.content || typeof args.content !== 'string') {
    throw new ValidationError('content is required and must be a string');
  }

  if (args.content.trim().length === 0) {
    throw new ValidationError('content cannot be empty');
  }

  if (args.content.length > 50000) {
    throw new ValidationError('content must be less than 50KB');
  }

  if (args.tags !== undefined) {
    if (!Array.isArray(args.tags)) {
      throw new ValidationError('tags must be an array');
    }
    if (args.tags.length > 10) {
      throw new ValidationError('maximum 10 tags allowed');
    }
    if (args.tags.some(t => typeof t !== 'string')) {
      throw new ValidationError('all tags must be strings');
    }
    if (args.tags.some(t => t.length > MAX_TAG_LENGTH)) {
      throw new ValidationError(`each tag must be less than ${MAX_TAG_LENGTH} characters`);
    }
  }

  return args;
}

export function validateRecallInput(input: unknown): RecallInput {
  const args = input as RecallInput;

  if (!args.query || typeof args.query !== 'string') {
    throw new ValidationError('query is required and must be a string');
  }

  if (args.query.trim().length === 0) {
    throw new ValidationError('query cannot be empty');
  }

  if (args.query.length > MAX_QUERY_LENGTH) {
    throw new ValidationError(`query must be less than ${MAX_QUERY_LENGTH} characters`);
  }

  if (args.limit !== undefined) {
    if (typeof args.limit !== 'number' || args.limit < 1 || args.limit > 100) {
      throw new ValidationError('limit must be a number between 1 and 100');
    }
  }

  // Validate date_range if provided
  if (args.date_range) {
    if (args.date_range.start && !isValidDate(args.date_range.start)) {
      throw new ValidationError('date_range.start must be a valid ISO date string');
    }
    if (args.date_range.end && !isValidDate(args.date_range.end)) {
      throw new ValidationError('date_range.end must be a valid ISO date string');
    }
    if (args.date_range.start && args.date_range.end) {
      const start = new Date(args.date_range.start);
      const end = new Date(args.date_range.end);
      if (start > end) {
        throw new ValidationError('date_range.start must be before date_range.end');
      }
    }
  }

  return args;
}

export function validateSearchInput(input: unknown): SearchInput {
  const args = input as SearchInput;

  // Validate query if provided
  if (args.query !== undefined) {
    if (typeof args.query !== 'string') {
      throw new ValidationError('query must be a string');
    }
    if (args.query.length > MAX_QUERY_LENGTH) {
      throw new ValidationError(`query must be less than ${MAX_QUERY_LENGTH} characters`);
    }
  }

  // Validate tags if provided
  if (args.tags !== undefined) {
    if (!Array.isArray(args.tags)) {
      throw new ValidationError('tags must be an array');
    }
    if (args.tags.some(t => typeof t !== 'string')) {
      throw new ValidationError('all tags must be strings');
    }
    if (args.tags.some(t => t.length > MAX_TAG_LENGTH)) {
      throw new ValidationError(`each tag must be less than ${MAX_TAG_LENGTH} characters`);
    }
  }

  // Validate limit
  if (args.limit !== undefined) {
    if (typeof args.limit !== 'number' || args.limit < 1 || args.limit > MAX_LIMIT) {
      throw new ValidationError(`limit must be a number between 1 and ${MAX_LIMIT}`);
    }
  }

  // Validate offset
  if (args.offset !== undefined) {
    if (typeof args.offset !== 'number' || args.offset < 0 || args.offset > MAX_OFFSET) {
      throw new ValidationError(`offset must be a number between 0 and ${MAX_OFFSET}`);
    }
  }

  // Validate date_range if provided
  if (args.date_range) {
    if (args.date_range.start && !isValidDate(args.date_range.start)) {
      throw new ValidationError('date_range.start must be a valid ISO date string');
    }
    if (args.date_range.end && !isValidDate(args.date_range.end)) {
      throw new ValidationError('date_range.end must be a valid ISO date string');
    }
    if (args.date_range.start && args.date_range.end) {
      const start = new Date(args.date_range.start);
      const end = new Date(args.date_range.end);
      if (start > end) {
        throw new ValidationError('date_range.start must be before date_range.end');
      }
    }
  }

  return args;
}

export function validateRollbackInput(input: unknown): RollbackInput {
  const args = input as RollbackInput;

  if (args.checkpoint_id === undefined || args.checkpoint_id === null) {
    throw new ValidationError('checkpoint_id is required');
  }

  if (typeof args.checkpoint_id !== 'number' || !Number.isInteger(args.checkpoint_id)) {
    throw new ValidationError('checkpoint_id must be an integer');
  }

  if (args.checkpoint_id < 1) {
    throw new ValidationError('checkpoint_id must be a positive number');
  }

  if (args.restore_description !== undefined) {
    if (typeof args.restore_description !== 'string') {
      throw new ValidationError('restore_description must be a string');
    }
    if (args.restore_description.length > MAX_DESCRIPTION_LENGTH) {
      throw new ValidationError(`restore_description must be less than ${MAX_DESCRIPTION_LENGTH} characters`);
    }
  }

  return args;
}

export function validateCreateCheckpointInput(input: unknown): CreateCheckpointInput {
  const args = input as CreateCheckpointInput;

  if (args.description !== undefined) {
    if (typeof args.description !== 'string') {
      throw new ValidationError('description must be a string');
    }
    if (args.description.length > MAX_DESCRIPTION_LENGTH) {
      throw new ValidationError(`description must be less than ${MAX_DESCRIPTION_LENGTH} characters`);
    }
  }

  return args;
}

export function validateDeleteMemoryInput(input: unknown): DeleteMemoryInput {
  const args = input as DeleteMemoryInput;

  if (args.memory_id === undefined || args.memory_id === null) {
    throw new ValidationError('memory_id is required');
  }

  if (typeof args.memory_id !== 'number' || !Number.isInteger(args.memory_id)) {
    throw new ValidationError('memory_id must be an integer');
  }

  if (args.memory_id < 1) {
    throw new ValidationError('memory_id must be a positive number');
  }

  return args;
}
