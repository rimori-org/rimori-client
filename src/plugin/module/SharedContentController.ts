import { ObjectTool } from '../../fromRimori/PluginTypes';
import { SupabaseClient } from '../CommunicationHandler';
import { RimoriClient } from '../RimoriClient';

export type SharedContent<T> = BasicSharedContent & T;

export interface BasicSharedContent {
  id: string;
  title: string;
  keywords: string[];
  verified: boolean;
  created_by: string;
  created_at: string;
  guild_id: string | null;
  lang_id: string | null;
}

export interface SharedContentCompletionState {
  content_id: string;
  state: 'completed' | 'ongoing' | 'hidden';
  reaction?: 'liked' | 'disliked' | null;
  bookmarked: boolean;
  created_at: string;
  updated_at: string;
}

export class SharedContentController {
  private supabase: SupabaseClient;
  private rimoriClient: RimoriClient;

  constructor(supabase: SupabaseClient, rimoriClient: RimoriClient) {
    this.supabase = supabase;
    this.rimoriClient = rimoriClient;
  }

  /**
   * Get new shared content. First searches for existing content matching filters that hasn't been completed,
   * then falls back to AI generation if nothing suitable is found.
   * @param params - Parameters object
   * @param params.table - Name of the shared content table (without plugin prefix)
   * @param params.skillType - Type of skill this content is for (grammar, reading, writing, speaking, listening, understanding)
   * @param params.placeholders - Placeholders for instructions template for AI generation (e.g., {topicAreas: "history"})
   * @param params.filter - Filter to find existing content:
   *   - `exact`: Match field value exactly (e.g., {topic_category: {filterType: "exact", value: "history"}})
   *   - `exclude`: Exclude specific field value (e.g., {difficulty: {filterType: "exclude", value: "hard"}})
   *   - `rag`: Use semantic similarity search (e.g., {topic: {filterType: "rag", value: "japanese culture"}})
   * @param params.customFields - Custom field values for AI-generated content (e.g., {topic_category: "history"})
   * @param params.skipDbSave - If true, don't save generated content to database
   * @param params.isPrivate - If true, content is guild-specific
   * @param params.ignoreSkillLevel - If true, don't filter by skill level or add skill level guidance to AI instructions
   * @returns Existing or newly generated shared content item
   */
  public async getNew<T>(params: {
    table: string;
    skillType: 'grammar' | 'reading' | 'writing' | 'speaking' | 'listening' | 'understanding';
    placeholders?: Record<string, string>;
    filter?: Record<string, { filterType: 'rag' | 'exact' | 'exclude'; value: string }>;
    customFields?: Record<string, string | number | boolean | null>;
    tool?: ObjectTool;
    skipDbSave?: boolean;
    isPrivate?: boolean;
    ignoreSkillLevel?: boolean;
  }): Promise<SharedContent<T>> {
    // Generate new content via backend endpoint
    const response = await this.rimoriClient.runtime.fetchBackend('/shared-content/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableName: params.table,
        skillType: params.skillType,
        placeholders: params.placeholders,
        filter: params.filter,
        customFields: params.customFields,
        tool: params.tool,
        options: {
          skipDbSave: params.skipDbSave,
          isPrivate: params.isPrivate,
          ignoreSkillLevel: params.ignoreSkillLevel,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate shared content: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Search for shared content by topic using RAG (semantic similarity).
   * @param tableName - Name of the shared content table
   * @param topic - Topic to search for
   * @param limit - Maximum number of results
   * @returns Array of similar shared content
   */
  public async searchByTopic<T>(tableName: string, topic: string, limit = 10): Promise<SharedContent<T>[]> {
    const fullTableName = this.getTableName(tableName);
    const completedTableName = this.getCompletedTableName(tableName);

    // Generate embedding for search topic
    const response = await this.rimoriClient.runtime.fetchBackend('/ai/embedding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: topic }),
    });

    if (!response.ok) {
      throw new Error(`Failed to generate embedding: ${response.statusText}`);
    }

    const { embedding } = await response.json();

    // RPC call for vector similarity search with completion filtering
    const { data, error } = await this.supabase.rpc('search_shared_content', {
      p_table_name: fullTableName,
      p_completed_table_name: completedTableName,
      p_embedding: JSON.stringify(embedding),
      p_limit: limit,
    });

    if (error) {
      console.error('Error searching shared content:', error);
      throw new Error('Error searching shared content');
    }

    return data || [];
  }

  /**
   * Get bookmarked shared content.
   * @param tableName - Name of the shared content table
   * @param limit - Maximum number of results
   * @returns Array of bookmarked content
   */
  public async getBookmarked<T>(tableName: string, limit = 30): Promise<SharedContent<T>[]> {
    const fullTableName = this.getTableName(tableName);
    const completedTableName = this.getCompletedTableName(tableName);

    const { data, error } = await this.supabase
      .from(fullTableName)
      .select(`*, completed:${completedTableName}!inner(*)`)
      .eq(`completed.bookmarked`, true)
      .limit(limit);

    if (error) {
      console.error('Error fetching bookmarked content:', error);
      throw new Error('Error fetching bookmarked content');
    }

    return (data || []) as unknown as SharedContent<T>[];
  }

  /**
   * Get ongoing shared content.
   * @param tableName - Name of the shared content table
   * @param limit - Maximum number of results
   * @returns Array of ongoing content
   */
  public async getOngoing<T>(tableName: string, limit = 30): Promise<SharedContent<T>[]> {
    const fullTableName = this.getTableName(tableName);
    const completedTableName = this.getCompletedTableName(tableName);

    const { data, error } = await this.supabase
      .from(fullTableName)
      .select(`*, completed:${completedTableName}!inner(*)`)
      .eq(`completed.state`, 'ongoing')
      .limit(limit);

    if (error) {
      console.error('Error fetching ongoing content:', error);
      throw new Error('Error fetching ongoing content');
    }

    return (data || []) as unknown as SharedContent<T>[];
  }

  /**
   * Get completed shared content.
   * @param tableName - Name of the shared content table
   * @param limit - Maximum number of results
   * @returns Array of completed content
   */
  public async getCompleted<T>(tableName: string, limit = 30): Promise<SharedContent<T>[]> {
    const fullTableName = this.getTableName(tableName);
    const completedTableName = this.getCompletedTableName(tableName);

    const { data, error } = await this.supabase
      .from(fullTableName)
      .select(`*, completed:${completedTableName}!inner(*)`)
      .eq(`completed.state`, 'completed')
      .limit(limit);

    if (error) {
      console.error('Error fetching completed content:', error);
      throw new Error('Error fetching completed content');
    }

    return (data || []) as unknown as SharedContent<T>[];
  }

  /**
   * Mark shared content as completed.
   * @param tableName - Name of the shared content table
   * @param contentId - ID of the content to mark as completed
   */
  public async complete(tableName: string, contentId: string): Promise<void> {
    const completedTableName = this.getCompletedTableName(tableName);

    const { error } = await this.supabase.from(completedTableName).upsert(
      {
        content_id: contentId,
        state: 'completed',
      },
      { onConflict: 'content_id,user_id' },
    );

    if (error) {
      console.error('Error completing shared content:', error);
      throw new Error('Error completing shared content');
    }
  }

  /**
   * Update the state of shared content.
   * @param tableName - Name of the shared content table
   * @param contentId - ID of the content
   * @param state - New state
   */
  public async updateState(
    tableName: string,
    contentId: string,
    state: 'completed' | 'ongoing' | 'hidden',
  ): Promise<void> {
    const completedTableName = this.getCompletedTableName(tableName);

    const { error } = await this.supabase.from(completedTableName).upsert(
      {
        content_id: contentId,
        state,
      },
      { onConflict: 'content_id,user_id' },
    );

    if (error) {
      console.error('Error updating content state:', error);
      throw new Error('Error updating content state');
    }
  }

  /**
   * Bookmark or unbookmark shared content.
   * @param tableName - Name of the shared content table
   * @param contentId - ID of the content
   * @param bookmarked - Whether to bookmark or unbookmark
   */
  public async bookmark(tableName: string, contentId: string, bookmarked: boolean): Promise<void> {
    const completedTableName = this.getCompletedTableName(tableName);

    const { error } = await this.supabase.from(completedTableName).upsert(
      {
        content_id: contentId,
        bookmarked,
      },
      { onConflict: 'content_id,user_id' },
    );

    if (error) {
      console.error('Error bookmarking content:', error);
      throw new Error('Error bookmarking content');
    }
  }

  /**
   * React to shared content with like/dislike.
   * @param tableName - Name of the shared content table
   * @param contentId - ID of the content
   * @param reaction - Reaction type or null to remove reaction
   */
  public async react(tableName: string, contentId: string, reaction: 'liked' | 'disliked' | null): Promise<void> {
    const completedTableName = this.getCompletedTableName(tableName);

    const { error } = await this.supabase.from(completedTableName).upsert(
      {
        content_id: contentId,
        reaction,
      },
      { onConflict: 'content_id,user_id' },
    );

    if (error) {
      console.error('Error reacting to content:', error);
      throw new Error('Error reacting to content');
    }
  }

  /**
   * Get a specific shared content item by ID.
   * @param tableName - Name of the shared content table
   * @param contentId - ID of the content
   * @returns The shared content item
   */
  public async get<T = any>(tableName: string, contentId: string): Promise<SharedContent<T>> {
    const fullTableName = this.getTableName(tableName);

    const { data, error } = await this.supabase.from(fullTableName).select('*').eq('id', contentId).single();

    if (error) {
      console.error('Error fetching shared content:', error);
      throw new Error('Error fetching shared content');
    }

    return data as SharedContent<T>;
  }

  /**
   * Fetch all shared content items.
   * @param tableName - Name of the shared content table
   * @param limit - Maximum number of results (default: 100)
   * @returns Array of all shared content items
   */
  public async getAll<T = any>(tableName: string, limit = 100): Promise<SharedContent<T>[]> {
    const fullTableName = this.getTableName(tableName);

    const { data, error } = await this.supabase.from(fullTableName).select('*').limit(limit);

    if (error) {
      console.error('Error fetching all shared content:', error);
      throw new Error('Error fetching all shared content');
    }

    return (data || []) as SharedContent<T>[];
  }

  /**
   * Create new shared content manually.
   * @param tableName - Name of the shared content table
   * @param content - Content to create
   * @returns Created content
   */
  public async create<T = any>(
    tableName: string,
    content: Omit<SharedContent<T>, 'id' | 'created_at' | 'created_by'>,
  ): Promise<SharedContent<T>> {
    const fullTableName = this.getTableName(tableName);

    const { data, error } = await this.supabase.from(fullTableName).insert(content).select().single();

    if (error) {
      console.error('Error creating shared content:', error);
      throw new Error('Error creating shared content');
    }

    return data as SharedContent<T>;
  }

  /**
   * Update existing shared content.
   * @param tableName - Name of the shared content table
   * @param contentId - ID of the content to update
   * @param updates - Updates to apply
   * @returns Updated content
   */
  public async update<T = any>(
    tableName: string,
    contentId: string,
    updates: Partial<SharedContent<T>>,
  ): Promise<SharedContent<T>> {
    const fullTableName = this.getTableName(tableName);

    const { data, error } = await this.supabase
      .from(fullTableName)
      .update(updates)
      .eq('id', contentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating shared content:', error);
      throw new Error('Error updating shared content');
    }

    return data as SharedContent<T>;
  }

  /**
   * Delete shared content.
   * @param tableName - Name of the shared content table
   * @param contentId - ID of the content to delete
   */
  public async remove(tableName: string, contentId: string): Promise<void> {
    const fullTableName = this.getTableName(tableName);

    const { error } = await this.supabase.from(fullTableName).delete().eq('id', contentId);

    if (error) {
      console.error('Error deleting shared content:', error);
      throw new Error('Error deleting shared content');
    }
  }

  private getCompletedTableName(tableName: string): string {
    return this.getTableName(tableName) + '_completed';
  }

  private getTableName(tableName: string): string {
    return `${this.rimoriClient.plugin.pluginId}_sc_${tableName}`;
  }
}
