import * as queries from '../database/queries.js';
import { getDatabase } from '../database/index.js';
import type { RememberInput, RememberOutput, DeleteMemoryInput, DeleteMemoryOutput } from '../types/index.js';

export function createMemory(input: RememberInput): RememberOutput {
  const { content, tags = [], metadata } = input;

  // Validate input
  if (!content || content.trim().length === 0) {
    throw new Error('Content is required');
  }

  if (content.length > 50000) {
    throw new Error('Content must be less than 50KB');
  }

  if (tags.length > 10) {
    throw new Error('Maximum 10 tags allowed');
  }

  const metadataStr = metadata ? JSON.stringify(metadata) : undefined;
  const db = getDatabase();

  // Use transaction to ensure atomic memory + tag creation
  const memoryId = db.transaction(() => {
    // Insert memory
    const id = queries.insertMemory(content, metadataStr);

    // Add tags within the same transaction
    for (const tagName of tags) {
      const tagId = queries.getOrCreateTag(tagName);
      queries.addTagToMemory(id, tagId);
    }

    return id;
  })();

  // Get the created memory to return timestamp
  const memory = queries.getMemoryById(memoryId);

  // Explicit null check instead of non-null assertion
  if (!memory) {
    throw new Error('Failed to retrieve created memory');
  }

  return {
    success: true,
    memory_id: memoryId,
    created_at: memory.created_at,
    tags: tags.map(t => t.toLowerCase()),
  };
}

export function deleteMemory(input: DeleteMemoryInput): DeleteMemoryOutput {
  const { memory_id } = input;

  if (!memory_id) {
    throw new Error('memory_id is required');
  }

  const deleted = queries.deleteMemoryById(memory_id);

  return {
    success: true,
    deleted,
  };
}

export function getAllMemories() {
  return queries.getAllMemories();
}
