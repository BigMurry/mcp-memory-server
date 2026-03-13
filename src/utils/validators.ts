import type {
  RememberInput,
  RecallInput,
  SearchInput,
  RollbackInput,
  CreateCheckpointInput,
  DeleteMemoryInput,
} from '../types/index.js';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
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

  if (args.limit !== undefined) {
    if (typeof args.limit !== 'number' || args.limit < 1 || args.limit > 100) {
      throw new ValidationError('limit must be a number between 1 and 100');
    }
  }

  return args;
}

export function validateSearchInput(input: unknown): SearchInput {
  const args = input as SearchInput;

  if (args.limit !== undefined) {
    if (typeof args.limit !== 'number' || args.limit < 1) {
      throw new ValidationError('limit must be a positive number');
    }
  }

  if (args.offset !== undefined) {
    if (typeof args.offset !== 'number' || args.offset < 0) {
      throw new ValidationError('offset must be a non-negative number');
    }
  }

  return args;
}

export function validateRollbackInput(input: unknown): RollbackInput {
  const args = input as RollbackInput;

  if (args.checkpoint_id === undefined || args.checkpoint_id === null) {
    throw new ValidationError('checkpoint_id is required');
  }

  if (typeof args.checkpoint_id !== 'number') {
    throw new ValidationError('checkpoint_id must be a number');
  }

  return args;
}

export function validateCreateCheckpointInput(input: unknown): CreateCheckpointInput {
  return input as CreateCheckpointInput;
}

export function validateDeleteMemoryInput(input: unknown): DeleteMemoryInput {
  const args = input as DeleteMemoryInput;

  if (args.memory_id === undefined || args.memory_id === null) {
    throw new ValidationError('memory_id is required');
  }

  if (typeof args.memory_id !== 'number') {
    throw new ValidationError('memory_id must be a number');
  }

  return args;
}
