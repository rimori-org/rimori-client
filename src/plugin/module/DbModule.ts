import { PostgrestFilterBuilder, PostgrestQueryBuilder } from '@supabase/postgrest-js';
import { SupabaseClient } from '../CommunicationHandler';
import { RimoriCommunicationHandler, RimoriInfo } from '../CommunicationHandler';

/**
 * Wraps PostgrestQueryBuilder and overrides select() to always return Row[].
 *
 * postgrest-js's GetResult type can only infer row types from string literals.
 * Dynamic select strings (e.g. `'col:' + getTableName('other') + '(id)'`) produce
 * GenericStringError. This wrapper forces select() to return Row[] regardless of
 * the query string, so callers using from<Row>() always get typed results.
 */
type DbQueryBuilder<Row extends Record<string, unknown>> = Omit<
  PostgrestQueryBuilder<any, any, { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] }, string>,
  'select'
> & {
  select(
    columns?: string,
    options?: { head?: boolean; count?: 'exact' | 'planned' | 'estimated' },
  ): PostgrestFilterBuilder<any, any, Row, Row[], string, any, 'GET'>;
};

export type PublicityLevel = 'own' | 'guild';

/**
 * Database module for plugin database operations.
 * Provides access to plugin tables with automatic prefixing and schema management.
 */
export class DbModule {
  private supabase: SupabaseClient;
  private rimoriInfo: RimoriInfo;
  public tablePrefix: string;
  public schema: string;

  constructor(supabase: SupabaseClient, communicationHandler: RimoriCommunicationHandler, info: RimoriInfo) {
    this.supabase = supabase;
    this.rimoriInfo = info;
    this.tablePrefix = info.tablePrefix;
    this.schema = info.dbSchema;

    communicationHandler.onUpdate((updatedInfo) => {
      this.rimoriInfo = updatedInfo;
      this.tablePrefix = updatedInfo.tablePrefix;
      this.schema = updatedInfo.dbSchema;
    });
  }

  /**
   * Query a database table.
   * Global tables (starting with 'global_') remain in public schema.
   * Plugin tables use the schema provided by rimori-main (plugins or plugins_alpha).
   *
   * The generic parameter `Row` lets callers opt-in to typed row access:
   *   client.db.from<{ id: string; name: string }>('decks')
   * When omitted, row fields are inferred from the select() string (each field typed as `any`).
   * Works with both literal and dynamic select strings.
   *
   * @param relation The table name (without prefix for plugin tables, with 'global_' for global tables).
   * @returns A Postgrest query builder for the table.
   */
  from<Row extends Record<string, unknown> = any>(relation: string): DbQueryBuilder<Row> {
    const tableName = this.getTableName(relation);
    if (relation.startsWith('global_')) {
      return this.supabase.schema('public').from(tableName) as unknown as DbQueryBuilder<Row>;
    }
    return this.supabase.schema(this.rimoriInfo.dbSchema).from(tableName) as unknown as DbQueryBuilder<Row>;
  }

  /**
   * Get the table name for a given plugin table.
   * Internally all tables are prefixed with the plugin id. This function is used to get the correct table name for a given public table.
   * @param table The plugin table name to get the full table name for.
   * @returns The full table name.
   */
  getTableName(table: string): string {
    if (/[A-Z]/.test(table)) {
      throw new Error('Table name cannot include uppercase letters. Please use snake_case for table names.');
    }
    if (table.startsWith('global_')) {
      return table.replace('global_', '');
    }
    return this.tablePrefix + '_' + table;
  }

  /**
   * Sets the publicity level of a plugin DB entry via the backend.
   *
   * - 'own'  — visible only to the creator (created_by=uid, guild_id=null)
   * - 'guild' — visible to all guild members (users: created_by=uid; moderators/admins: created_by=null; both with guild_id set)
   *
   * @param table The plugin table name (without prefix, e.g. 'pages')
   * @param entryId The UUID of the entry to update
   * @param publicity The desired publicity level
   */
  async setPublicity(table: string, entryId: string, publicity: PublicityLevel): Promise<void> {
    const tableName = this.getTableName(table);
    await fetch(`${this.rimoriInfo.backendUrl}/db-entry/publicity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.rimoriInfo.token}`,
      },
      body: JSON.stringify({
        table_name: tableName,
        schema: this.rimoriInfo.dbSchema,
        entry_id: entryId,
        publicity,
      }),
    });
  }
}
