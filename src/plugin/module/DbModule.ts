import { PostgrestClientOptions, PostgrestQueryBuilder } from '@supabase/postgrest-js';
import { SupabaseClient } from '../CommunicationHandler';
// import { GenericSchema } from '@supabase/postgrest-js/dist/module/lib/types';
import { RimoriCommunicationHandler, RimoriInfo } from '../CommunicationHandler';
import { GenericSchema, GenericTable } from '@supabase/postgrest-js/dist/cjs/types/common/common';

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
   * @param relation The table name (without prefix for plugin tables, with 'global_' for global tables).
   * @returns A Postgrest query builder for the table.
   */
  from<ViewName extends string & keyof GenericSchema['Views'], View extends GenericSchema['Views'][ViewName]>(
    relation: string,
  ): PostgrestQueryBuilder<PostgrestClientOptions, GenericSchema, GenericTable, ViewName, View> {
    const tableName = this.getTableName(relation);
    // Use the schema determined by rimori-main based on release channel
    // Global tables (starting with 'global_') remain in public schema
    // Plugin tables use the schema provided by rimori-main (plugins or plugins_alpha)
    if (relation.startsWith('global_')) {
      // Global tables stay in public schema
      return this.supabase.schema('public').from(tableName);
    }
    // Plugin tables go to the schema provided by rimori-main
    return this.supabase.schema(this.rimoriInfo.dbSchema).from(tableName);
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
}
