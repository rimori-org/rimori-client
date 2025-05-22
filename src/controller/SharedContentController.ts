import { SupabaseClient } from '@supabase/supabase-js';
import { RimoriClient } from "../plugin/RimoriClient";
import { ObjectRequest } from "./ObjectController";

export interface BasicAssignment<T> {
  id: string;
  createdAt: Date;
  topic: string;
  createdBy: string;
  verified: boolean;
  keywords: any;
  data: T;
}

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
  ): Promise<BasicAssignment<T>> {
    const query = this.supabase.from("shared_content")
      .select("*, scc:shared_content_completed(id)")
      .eq('content_type', contentType)
      .is('scc.id', null)
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
      topic: instructions.topic,
      keywords: instructions.keywords.map(({ text }: { text: string }) => text),
      data: { ...instructions, topic: undefined, keywords: undefined, ...generatorInstructions.fixedProperties },
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

    generatorInstructions.tool.topic = {
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
      .select("topic, keywords, scc:shared_content_completed(id)")
      .eq('content_type', contentType)
      .not('scc.id', 'is', null)

    if (filter) {
      query.contains('data', filter);
    }

    const { data: oldAssignments, error } = await query;

    if (error) {
      console.error('error fetching old assignments:', error);
      return [];
    }
    return oldAssignments.map(({ topic, keywords }) => `${topic}(${keywords.join(',')})`);
  }

  public async getSharedContent<T>(contentType: string, id: string): Promise<BasicAssignment<T>> {
    const { data, error } = await this.supabase.from("shared_content").select().eq('content_type', contentType).eq('id', id).single();
    if (error) {
      console.error('error fetching shared content:', error);
      throw new Error('error fetching shared content');
    }
    return data;
  }

  public async completeSharedContent(contentType: string, assignmentId: string) {
    await this.supabase.from("shared_content_completed").insert({ content_type: contentType, id: assignmentId });
  }
}