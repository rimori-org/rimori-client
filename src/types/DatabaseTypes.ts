
// Database table structure definitions

/**
 * Supported database column data types for table schema definitions.
 */
type DbColumnType = 'decimal' | 'integer' | 'text' | 'boolean' | 'json' | 'timestamp' | 'uuid';

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
  /** The name of the column before it was renamed */
  old_name?: string;
  /** Whether the column is deprecated. The column gets renamed to column_name_old. To fully remove the column, first set deprecated to true and then after a release, remove the column from the table definition. */
  deprecated?: boolean;
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
  /** Column definitions for the table */
  columns: {
    [column_name: string]: DbColumnDefinition;
  };
}

/**
 * Full table definition that includes automatically generated fields.
 */
export type FullTable<T extends Record<string, DbColumnDefinition>> = T & BaseTableStructure;
