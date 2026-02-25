// Database table structure definitions

/**
 * Supported database column data types for table schema definitions.
 */
/**
 * 'markdown' is stored as `text` in the database.
 * Marking a column as 'markdown' causes the migration system to:
 *  1. Add an `updated_at` timestamp + trigger to the table.
 *  2. Add an `updated_at` trigger so the image-sync cron can detect recently
 *     modified entries. The cron derives which columns to scan from release.db_schema.
 */
type DbColumnType = 'decimal' | 'integer' | 'text' | 'boolean' | 'json' | 'timestamp' | 'uuid' | 'markdown';

/**
 * Foreign key relationship configuration with cascade delete support.
 * Defines a relationship where the source record is deleted when the destination record is deleted.
 */
interface ForeignKeyRelation {
  /** The target table that this column references */
  references_table: string;
  /** The target column in the referenced table (defaults to 'id') */
  references_column?: string;
  /** Whether to cascade delete when the referenced record is deleted */
  on_delete_cascade: boolean;
}

/**
 * Database column definition with support for types, constraints, and relationships.
 */
export interface DbColumnDefinition {
  /** The data type of the column */
  type: DbColumnType;
  /** Human-readable description of the column's purpose */
  description: string;
  /** Whether the column can contain null values */
  nullable?: boolean;
  /** Whether the column has a unique constraint */
  unique?: boolean;
  /** Default value for the column. can also use sql functions like now(), auth.uid() or gen_random_uuid() */
  default_value?: string | number | boolean;
  /** Array of allowed values for enumerated columns */
  // enum?: string[];
  /** Foreign key relationship configuration */
  foreign_key?: ForeignKeyRelation;
  /** The name of the column before it was renamed. */
  old_name?: string;
  /** Whether the column is deprecated. The column gets renamed to column_name_old. To fully remove the column, first set deprecated to true and then after a release, remove the column from the table definition. */
  deprecated?: boolean;
  /** Whether the column is a primary key */
  // primary_key?: boolean;
  /** Restrictions for the column. If the column is restricted, the permission is further restricted. E.g. if the column is restricted to user, then the user can only read the column if they have the right permission.
   * Example: Denying users to update the column, but allowing the moderator to update the column.
   */
  restrict?: {
    /** Restrictions for the user */
    user: Partial<Omit<DbPermissionDefinition, 'delete'>>;
    /** Restrictions for the guild moderator */
    guild_moderator?: Partial<Omit<DbPermissionDefinition, 'delete'>>;
    /** Restrictions for the language moderator */
    lang_moderator?: Partial<Omit<DbPermissionDefinition, 'delete'>>;
    /** Restrictions for the maintainer */
    // maintainer?: Partial<Omit<DbPermissionDefinition, 'delete'>>;
  };
}

/**
 * Base table structure that all database tables inherit.
 * Includes standard audit fields for tracking creation and ownership.
 */
interface BaseTableStructure {
  /** Unique identifier for the record */
  id: DbColumnDefinition;
  /** Timestamp when the record was created */
  created_at: DbColumnDefinition;
  /** ID of the user who created the record */
  created_by: DbColumnDefinition;
}

/**
 * Normal database table schema definition.
 * Defines the structure, constraints, and relationships for a standard database table.
 */
export interface DbNormalTableDefinition {
  /** Type discriminator for normal tables */
  type: 'table';
  /** Name of the database table */
  table_name: string;
  /** Description of the table's purpose and usage */
  description: string;
  /** Permissions for the table */
  permissions: {
    /** Permissions for the user */
    user: DbPermissionDefinition;
    /** Permissions for the guild moderator */
    guild_moderator?: DbPermissionDefinition;
    /** Permissions for the language moderator */
    lang_moderator?: DbPermissionDefinition;
    /** Permissions for the maintainer */
    // maintainer?: DbPermissionDefinition;
  };
  /** Column definitions for the table */
  columns: {
    [column_name: string]: DbColumnDefinition;
  };
}

/**
 * Shared content table schema definition.
 * Defines the structure for community-shared content tables with automatic columns and verification.
 * Table naming: {pluginId}_sc_{table_name}
 * Automatic columns: title (text), keywords (text[]), content_status (text: featured/community/unverified), embedding (vector)
 * Hardcoded permissions: read ALL public verified (community/featured) + own, insert/update/delete OWN
 */
export interface DbSharedContentTableDefinition {
  /** Type discriminator for shared content tables */
  type: 'shared_content';
  /** Name of the database table (will become {pluginId}_sc_{table_name}) */
  table_name: string;
  /** Description of the table's purpose and usage */
  description: string;
  /** AI prompt for generating content. Supports placeholders like {{topic}}, {{level}}, etc. */
  instructions: string;
  /** Verification settings for the content. */
  verification: {
    /** AI prompt to verify content quality. Supports placeholders like {{topic}}, {{level}}, etc. */
    prompt: string;
    /** Whether to automatically verify the content. If true, the content will be verified automatically when it is inserted and shared with the community. */
    auto_verify: boolean;
  };
  /** Column definitions for the table (excluding auto-generated columns) */
  columns: {
    [column_name: string]: DbColumnDefinition & {
      /** Whether the column is used for LLM generation. If not set, the column is not used for LLM generation. */
      expose_to_llm?: boolean;
    };
  };
}

/**
 * Complete database table schema definition.
 * Can be either a normal table or a shared content table.
 */
export type DbTableDefinition = DbNormalTableDefinition | DbSharedContentTableDefinition;

/**
 * Permission definition for a database table.
 * NONE means the action is not allowed.
 * OWN means only do the action on your own records.
 * GUILD means do the action on all records in the guild.
 * LANG means do the action on all records in the language.
 * ALL means do the action on all records.
 *
 * Defines the permissions for a database table.
 */
export type DbPermission = 'NONE' | 'OWN' | 'GUILD' | 'LANG' | 'ALL';

/**
 * Permission definition for a database table.
 * Defines the permissions for a database table.
 */
export interface DbPermissionDefinition {
  read: DbPermission;
  insert: DbPermission;
  update: DbPermission;
  delete: DbPermission;
}

/**
 * Full table definition that includes automatically generated fields.
 */
export type FullTable<T extends Record<string, DbColumnDefinition>> = T & BaseTableStructure;
