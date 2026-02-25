import { SupabaseClient } from '../CommunicationHandler';
import { RimoriCommunicationHandler, RimoriInfo } from '../CommunicationHandler';
import { EventModule } from './EventModule';

export type TriggerAction = { action_key: string } & Record<string, string | number | boolean>;

export interface CreateExerciseParams {
  plugin_id: string;
  start_date: string;
  end_date: string;
  trigger_action: TriggerAction;
  name: string;
  description: string;
  estimated_duration: number;
  achievement_topic: string; // Required: Topic in format "skillCategory.accomplishmentKeyword" for matching accomplishments
}

export interface Exercise {
  id: string;
  plugin_id: string;
  start_date: string;
  end_date: string;
  trigger_action: TriggerAction;
  achievement_topic: string;
  name: string;
  description: string;
  estimated_duration: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Controller for exercise-related operations.
 * Provides access to weekly exercises and exercise management.
 */
export class ExerciseModule {
  private supabase: SupabaseClient;
  private communicationHandler: RimoriCommunicationHandler;
  private eventModule: EventModule;
  private backendUrl: string;
  private token: string;

  constructor(
    supabase: SupabaseClient,
    communicationHandler: RimoriCommunicationHandler,
    info: RimoriInfo,
    eventModule: EventModule,
  ) {
    this.supabase = supabase;
    this.communicationHandler = communicationHandler;
    this.eventModule = eventModule;
    this.token = info.token;
    this.backendUrl = info.backendUrl;

    this.communicationHandler.onUpdate((updatedInfo) => {
      this.token = updatedInfo.token;
    });
  }

  /**
   * Fetches weekly exercises from the weekly_exercises view.
   * Shows exercises for the current week that haven't expired.
   * @returns Array of exercise objects.
   */
  async view(): Promise<Exercise[]> {
    const { data, error } = await this.supabase.from('weekly_exercises').select('*');

    if (error) {
      throw new Error(`Failed to fetch weekly exercises: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Creates one or more exercises via the backend API.
   * Multiple exercises are sent in a single bulk request to ensure atomicity —
   * either all succeed or none are inserted.
   * @param params Exercise creation parameters (single or array).
   * @returns Created exercise objects.
   */
  async add(params: CreateExerciseParams | CreateExerciseParams[]): Promise<Exercise[]> {
    const exercises = Array.isArray(params) ? params : [params];

    const response = await fetch(`${this.backendUrl}/exercises`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({ exercises }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create exercises: ${errorText}`);
    }

    const data: Exercise[] = await response.json();

    this.eventModule.emit('global.exercises.triggerChange');

    return data;
  }

  /**
   * Deletes an exercise via the backend API.
   * @param id The exercise ID to delete.
   * @returns Success status.
   */
  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.backendUrl}/exercises/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete exercise: ${errorText}`);
    }

    this.eventModule.emit('global.exercises.triggerChange');

    return await response.json();
  }
}
