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
  attributes: TriggerAction;
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

  constructor(
    supabase: SupabaseClient,
    communicationHandler: RimoriCommunicationHandler,
    _info: RimoriInfo,
    eventModule: EventModule,
  ) {
    this.supabase = supabase;
    this.communicationHandler = communicationHandler;
    this.eventModule = eventModule;
  }

  /**
   * Fetches weekly exercises from the weekly_exercises view.
   * Shows exercises for the current week that haven't expired.
   * @returns Array of exercise objects.
   */
  async view(): Promise<Exercise[]> {
    const { data, error } = await this.supabase.schema('public').from('weekly_exercises').select('*');

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

    const response = await this.communicationHandler.fetchBackend('/exercises', {
      method: 'POST',
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
   * Requests a new exercise session token from rimori-main.
   * Use this for self-initiated exercises (user navigated to plugin via navbar and clicked Start).
   * For dashboard-triggered exercises (onMainPanelAction), the token is provided automatically.
   *
   * Emits `global.exercise.triggerStart` and waits for rimori-main to respond with the
   * session token via `global.session.triggerUpdate`. The token is then automatically
   * available for AI calls.
   *
   * @param params.actionKey The action key identifying this exercise type.
   * @param params.knowledgeId Optional knowledge ID for tracking what was studied.
   */
  async start(params: { actionKey: string; knowledgeId?: string }): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        listener.off();
        reject(new Error('Exercise start timed out: rimori-main did not respond within 5s'));
      }, 5000);

      const listener = this.eventModule.on<{ session_token: string | null }>(
        'global.session.triggerUpdate',
        ({ data }) => {
          if (data.session_token) {
            clearTimeout(timeout);
            listener.off();
            resolve();
          }
        },
      );

      this.eventModule.emit('global.exercise.triggerStart', params);
    });
  }

  /**
   * Deletes an exercise via the backend API.
   * @param id The exercise ID to delete.
   * @returns Success status.
   */
  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const response = await this.communicationHandler.fetchBackend(`/exercises/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete exercise: ${errorText}`);
    }

    this.eventModule.emit('global.exercises.triggerChange');

    return await response.json();
  }
}
