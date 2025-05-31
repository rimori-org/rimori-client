import { SupabaseClient } from '@supabase/supabase-js';
import { RimoriClient } from "../plugin/RimoriClient";
import { ObjectRequest } from "./ObjectController";

export interface SharedContentObjectRequest extends ObjectRequest {
  fixedProperties?: Record<string, string | number | boolean>
}

export type SharedContentFilter = Record<string, string | number | boolean>

export class SharedContentController {
  private supabase: SupabaseClient;
  private rimoriClient: RimoriClient;

  constructor(supabase: SupabaseClient, rimoriClient: RimoriClient) {
    this.supabase = supabase;
    this.rimoriClient = rimoriClient;
  }

  /**
   * Fetch new shared content for a given content type.
   * @param contentType - The type of content to fetch.
   * @param generatorInstructions - The instructions for the generator. The object needs to have a tool property with a topic and keywords property to let a new unique topic be generated.
   * @param filter - An optional filter to apply to the query.
   * @param privateTopic - An optional flag to indicate if the topic should be private and only be visible to the user.
   * @returns The new shared content.
   */
  public async getNewSharedContent<T>(
    contentType: string,
    generatorInstructions: SharedContentObjectRequest,
    //this filter is there if the content should be filtered additionally by a column and value
    filter?: SharedContentFilter,
    privateTopic?: boolean,
  ): Promise<SharedContent<T>> {
    const query = this.supabase.from("shared_content")
      .select("*, scc:shared_content_completed(id)")
      .eq('content_type', contentType)
      .is('scc.id', null)
      .is('deleted_at', null)
      .limit(10);

    if (filter) {
      query.contains('data', filter);
    }

    const { data: newAssignments, error } = await query;

    if (error) {
      console.error('error fetching new assignments:', error);
      throw new Error('error fetching new assignments');
    }

    console.log('newAssignments:', newAssignments);

    if (newAssignments.length > 0) {
      const index = Math.floor(Math.random() * newAssignments.length);
      return newAssignments[index];
    }

    // generate new assignments
    const fullInstructions = await this.getGeneratorInstructions(contentType, generatorInstructions, filter);

    console.log('fullInstructions:', fullInstructions);

    const instructions = await this.rimoriClient.llm.getObject(fullInstructions);

    console.log('instructions:', instructions);

    const { data: newAssignment, error: insertError } = await this.supabase.from("shared_content").insert({
      private: privateTopic,
      content_type: contentType,
      title: instructions.title,
      keywords: instructions.keywords.map(({ text }: { text: string }) => text),
      data: { ...instructions, title: undefined, keywords: undefined, ...generatorInstructions.fixedProperties },
    }).select();

    if (insertError) {
      console.error('error inserting new assignment:', insertError);
      throw new Error('error inserting new assignment');
    }

    return newAssignment[0];
  }

  private async getGeneratorInstructions(contentType: string, generatorInstructions: ObjectRequest, filter?: SharedContentFilter): Promise<ObjectRequest> {
    const completedTopics = await this.getCompletedTopics(contentType, filter);

    generatorInstructions.instructions += `
    The following topics are already taken: ${completedTopics.join(', ')}`;

    generatorInstructions.tool.title = {
      type: "string",
      description: "What the topic is about. Short. ",
    }
    generatorInstructions.tool.keywords = {
      type: [{ text: { type: "string" } }],
      description: "Keywords around the topic of the assignment.",
    }
    return generatorInstructions;
  }

  private async getCompletedTopics(contentType: string, filter?: SharedContentFilter): Promise<string[]> {
    const query = this.supabase.from("shared_content")
      .select("title, keywords, scc:shared_content_completed(id)")
      .eq('content_type', contentType)
      .not('scc.id', 'is', null)
      .is('deleted_at', null)

    if (filter) {
      query.contains('data', filter);
    }

    const { data: oldAssignments, error } = await query;

    if (error) {
      console.error('error fetching old assignments:', error);
      return [];
    }
    return oldAssignments.map(({ title, keywords }) => `${title}(${keywords.join(',')})`);
  }

  public async getSharedContent<T>(contentType: string, id: string): Promise<SharedContent<T>> {
    const { data, error } = await this.supabase.from("shared_content").select().eq('content_type', contentType).eq('id', id).is('deleted_at', null).single();
    if (error) {
      console.error('error fetching shared content:', error);
      throw new Error('error fetching shared content');
    }
    return data;
  }

  public async completeSharedContent(contentType: string, assignmentId: string) {
    await this.supabase.from("shared_content_completed").insert({ content_type: contentType, id: assignmentId });
  }

  /**
   * Fetch shared content from the database based on optional filters.
   * @param contentType - The type of content to fetch.
   * @param filter - Optional filter to apply to the query.
   * @param limit - Optional limit for the number of results.
   * @returns Array of shared content matching the criteria.
   */
  public async getSharedContentList<T>(contentType: string, filter?: SharedContentFilter, limit?: number): Promise<SharedContent<T>[]> {
    const query = this.supabase.from("shared_content").select("*").eq('content_type', contentType).is('deleted_at', null).limit(limit ?? 30);

    if (filter) {
      query.contains('data', filter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('error fetching shared content:', error);
      throw new Error('error fetching shared content');
    }

    return data;
  }

  /**
   * Insert new shared content into the database.
   * @param param
   * @param param.contentType - The type of content to insert.
   * @param param.title - The title of the content.
   * @param param.keywords - Keywords associated with the content.
   * @param param.data - The content data to store.
   * @param param.privateTopic - Optional flag to indicate if the topic should be private.
   * @returns The inserted shared content.
   * @throws {Error} if insertion fails.
   */
  public async createSharedContent<T>({ contentType, title, keywords, data, privateTopic }: Omit<SharedContent<T>, 'id'>): Promise<SharedContent<T>> {
    const { data: newContent, error } = await this.supabase.from("shared_content").insert({
      private: privateTopic,
      content_type: contentType,
      title,
      keywords,
      data,
    }).select();

    if (error) {
      console.error('error inserting shared content:', error);
      throw new Error('error inserting shared content');
    }

    return newContent[0];
  }

  /**
   * Update existing shared content in the database.
   * @param id - The ID of the content to update.
   * @param updates - The updates to apply to the shared content.
   * @returns The updated shared content.
   * @throws {Error} if update fails.
   */
  public async updateSharedContent<T>(id: string, updates: Partial<SharedContent<T>>): Promise<SharedContent<T>> {
    const updateData: any = {};

    if (updates.contentType) updateData.content_type = updates.contentType;
    if (updates.title) updateData.title = updates.title;
    if (updates.keywords) updateData.keywords = updates.keywords;
    if (updates.data) updateData.data = updates.data;
    if (updates.privateTopic !== undefined) updateData.private = updates.privateTopic;

    const { data: updatedContent, error } = await this.supabase.from("shared_content").update(updateData).eq('id', id).select();

    if (error) {
      console.error('error updating shared content:', error);
      throw new Error('error updating shared content');
    }

    if (!updatedContent || updatedContent.length === 0) {
      throw new Error('shared content not found');
    }

    return updatedContent[0];
  }

  /**
   * Soft delete shared content by setting the deleted_at timestamp.
   * @param id - The ID of the content to delete.
   * @returns The deleted shared content record.
   * @throws {Error} if deletion fails or content not found.
   */
  public async removeSharedContent(id: string): Promise<SharedContent<any>> {
    const { data: deletedContent, error } = await this.supabase
      .from("shared_content")
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select();

    if (error) {
      console.error('error deleting shared content:', error);
      throw new Error('error deleting shared content');
    }

    if (!deletedContent || deletedContent.length === 0) {
      throw new Error('shared content not found or already deleted');
    }

    return deletedContent[0];
  }
}

/**
 * Interface representing shared content in the system.
 * @template T The type of data stored in the content
 */
export interface SharedContent<T> {
  /** The id of the content */
  id: string;

  /** The type/category of the content (e.g. 'grammar_exercises', 'flashcards', etc.) */
  contentType: string;

  /** The human readable title of the content */
  title: string;

  /** Array of keywords/tags associated with the content for search and categorization */
  keywords: string[];

  /** The actual content data of type T */
  data: T;

  /** Whether this content should only be visible to the creator. Defaults to false if not specified */
  privateTopic?: boolean;
}