import { SupabaseClient } from '@supabase/supabase-js';
import { RimoriClient } from '../plugin/RimoriClient';

export type TriggerAction = { action_key: string } & Record<string, string | number | boolean>;

export interface CreateExerciseParams {
  plugin_id: string;
  start_date: string;
  end_date: string;
  trigger_action: TriggerAction;
  name: string;
  description: string;
  estimated_duration: number;
  topics: string[]; // Required: Array of topics in format "skillCategory.accomplishmentKeyword" for matching accomplishments
}

export interface Exercise {
  id: string;
  plugin_id: string;
  start_date: string;
  end_date: string;
  trigger_action: TriggerAction;
  name: string;
  description: string;
  estimated_duration: number;
  created_at?: string;
  updated_at?: string;
}

export class ExerciseController {
  private supabase: SupabaseClient;
  private rimoriClient: RimoriClient;

  constructor(supabase: SupabaseClient, rimoriClient: RimoriClient) {
    this.supabase = supabase;
    this.rimoriClient = rimoriClient;
  }

  /**
   * Fetches weekly exercises from the weekly_exercises view.
   * Shows exercises for the current week that haven't expired.
   * @returns Array of exercise objects.
   */
  public async viewWeeklyExercises(): Promise<Exercise[]> {
    const { data, error } = await this.supabase.from('weekly_exercises').select('*');

    if (error) {
      throw new Error(`Failed to fetch weekly exercises: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Creates multiple exercises via the backend API.
   * All requests are made in parallel but only one event is emitted.
   * @param token The token to use for authentication.
   * @param backendUrl The URL of the backend API.
   * @param exercises Exercise creation parameters.
   * @returns Created exercise objects.
   */
  public async addExercise(token: string, backendUrl: string, exercises: CreateExerciseParams[]): Promise<Exercise[]> {
    const responses = await Promise.all(
      exercises.map(async (exercise) => {
        const response = await fetch(`${backendUrl}/exercises`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(exercise),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create exercise: ${errorText}`);
        }

        return await response.json();
      }),
    );

    this.rimoriClient.event.emit('global.exercises.triggerChange');

    return responses;
  }

  /**
   * Deletes an exercise via the backend API.
   * @param token The token to use for authentication.
   * @param backendUrl The URL of the backend API.
   * @param exerciseId The exercise ID to delete.
   * @returns Success status.
   */
  public async deleteExercise(
    token: string,
    backendUrl: string,
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${backendUrl}/exercises/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete exercise: ${errorText}`);
    }
    this.rimoriClient.event.emit('global.exercises.triggerChange');

    return await response.json();
  }
}
