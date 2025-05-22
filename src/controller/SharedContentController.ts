import { v4 as uuidv4 } from 'uuid';
import { ObjectRequest } from "./ObjectController";
import { RimoriClient } from "../plugin/RimoriClient";
import { SupabaseClient } from '@supabase/supabase-js';

export interface BasicAssignment<T> {
  id: string;
  createdAt: Date;
  topic: string;
  createdBy: string;
  verified: boolean;
  keywords: any;
  data: T;
}

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
   * @returns The new shared content.
   */
  public async fetchNewSharedContent<T>(
    contentType: string,
    generatorInstructions: ObjectRequest,
    //this filter is there if the content should be filtered additionally by a column and value
    filter?: { column: string, value: string | number | boolean },
  ): Promise<BasicAssignment<T>> {
    const query = this.supabase.from("shared_content")
      .select("*, scc:shared_content_completed(id)")
      .eq('content_type', contentType)
      .is('scc.id', null)
      .limit(10);

    if (filter) {
      query.eq(filter.column, filter.value);
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
    const fullInstructions = await this.getGeneratorInstructions(contentType, generatorInstructions);

    console.log('fullInstructions:', fullInstructions);

    const instructions = await this.rimoriClient.llm.getObject(fullInstructions);

    console.log('instructions:', instructions);

    const { data: newAssignment, error: insertError } = await this.supabase.from("shared_content").insert({
      content_type: contentType,
      topic: instructions.topic,
      keywords: instructions.keywords.map(({ text }: { text: string }) => text),
      data: { ...instructions, topic: undefined, keywords: undefined },
    }).select();

    if (insertError) {
      console.error('error inserting new assignment:', insertError);
      throw new Error('error inserting new assignment');
    }

    return newAssignment[0];
  }

  private async getGeneratorInstructions(contentType: string, generatorInstructions: ObjectRequest): Promise<ObjectRequest> {
    const completedTopics = await this.getCompletedTopics(contentType);

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

  private async getCompletedTopics(contentType: string): Promise<string[]> {
    const { data: oldAssignments, error } = await this.supabase.from("shared_content")
      .select("topic, keywords, scc:shared_content_completed(id)")
      .eq('content_type', contentType)
      .not('scc.id', 'is', null)

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