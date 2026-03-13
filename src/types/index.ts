// Memory types
export interface Memory {
  id: number;
  content: string;
  created_at: string;
  updated_at: string;
  tags?: string[];
}

export interface MemoryWithTags extends Memory {
  tags: string[];
}

// Input types
export interface RememberInput {
  content: string;
  tags?: string[];
  metadata?: {
    source?: string;
    importance?: 'low' | 'medium' | 'high';
    expires_at?: string;
  };
}

export interface RecallInput {
  query: string;
  limit?: number;
  tags?: string[];
  date_range?: {
    start?: string;
    end?: string;
  };
  importance?: 'low' | 'medium' | 'high';
  match_strategy?: 'keyword' | 'semantic';
}

export interface RollbackInput {
  checkpoint_id: number;
  restore_description?: string;
}

export interface SearchInput {
  query?: string;
  tags?: string[];
  date_range?: {
    start?: string;
    end?: string;
  };
  sort_by?: 'relevance' | 'date_desc' | 'date_asc';
  limit?: number;
  offset?: number;
}

export interface CreateCheckpointInput {
  description?: string;
}

export interface ListCheckpointsInput {
  limit?: number;
  offset?: number;
}

export interface DeleteMemoryInput {
  memory_id: number;
}

// Output types
export interface RememberOutput {
  success: boolean;
  memory_id: number;
  created_at: string;
  tags: string[];
}

export interface RecallOutput {
  success: boolean;
  results: Array<{
    memory_id: number;
    content: string;
    tags: string[];
    relevance_score: number;
    created_at: string;
    updated_at: string;
  }>;
  total: number;
}

export interface RollbackOutput {
  success: boolean;
  checkpoint_id: number;
  restored_at: string;
  memories_restored: number;
}

export interface SearchOutput {
  success: boolean;
  memories: Array<{
    id: number;
    content: string;
    tags: string[];
    created_at: string;
    updated_at: string;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export interface CreateCheckpointOutput {
  success: boolean;
  checkpoint_id: number;
  memories_saved: number;
  created_at: string;
}

export interface ListCheckpointsOutput {
  success: boolean;
  checkpoints: Array<{
    id: number;
    description: string;
    memory_count: number;
    created_at: string;
  }>;
}

export interface DeleteMemoryOutput {
  success: boolean;
  deleted: boolean;
}
