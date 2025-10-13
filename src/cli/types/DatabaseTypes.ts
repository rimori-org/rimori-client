// Database table structure definitions

/**
 * Supported database column data types for table schema definitions.
 */
type DbColumnType =
  | 'decimal'
  | 'integer'
  | 'text'
  | 'boolean'
  | 'json'
  | 'timestamp'
  | 'uuid';

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
    /** Restrictions for the moderator */
    moderator?: Partial<Omit<DbPermissionDefinition, 'delete'>>;
    /** Restrictions for the maintainer */
    // maintainer?: Partial<DbPermissionDefinition>,
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
 * Complete database table schema definition.
 * Defines the structure, constraints, and relationships for a database table.
 */
export interface DbTableDefinition {
  /** Name of the database table */
  table_name: string;
  /** Description of the table's purpose and usage */
  description: string;
  /** Permissions for the table */
  permissions: {
    user: DbPermissionDefinition;
    moderator?: DbPermissionDefinition;
    // maintainer?: DbPermissionDefinition,
  };
  /** Column definitions for the table */
  columns: {
    [column_name: string]: DbColumnDefinition;
  };
}

/**
 * Permission definition for a database table.
 * NONE means the action is not allowed.
 * OWN means only do the action on your own records.
 * ALL means do the action on all records.
 *
 * Defines the permissions for a database table.
 */
export type DbPermission = 'NONE' | 'OWN' | 'ALL';

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
export type FullTable<T extends Record<string, DbColumnDefinition>> = T &
  BaseTableStructure;
