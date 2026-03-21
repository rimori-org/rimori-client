// Prompt configuration type definitions
// Used by plugins in their rimori/prompts.config.ts files

/**
 * Formatting options for string array variables when rendered into prompts.
 */
export type StringArrayFormat = 'numberedList' | 'bulletpointList' | 'commaList' | 'newlineList';

/**
 * Enum variable resolved server-side from a fixed set of values.
 * Supports conditional prompt text per value.
 */
export interface EnumVariable {
  type: 'enum';
  values: string[];
  conditions?: Record<string, string>;
}

/**
 * Numeric variable with min/max bounds.
 * Supports conditional prompt text per value.
 */
export interface NumberVariable {
  type: 'number';
  min: number;
  max: number;
  conditions?: Record<string, string>;
}

/**
 * Free-text string variable with optional prefix/suffix wrappers.
 */
export interface StringVariable {
  type: 'string';
  pre?: string;
  after?: string;
}

/**
 * Array-of-strings variable with optional formatting and prefix/suffix wrappers.
 */
export interface StringArrayVariable {
  type: 'string[]';
  format?: StringArrayFormat;
  pre?: string;
  after?: string;
}

/**
 * UUID variable referencing a backend entity by ID.
 * The backend resolves the UUID to a formatted string via a registered resolver.
 * Safe in system instructions because the resolved content is backend-controlled.
 */
export interface UuidVariable {
  type: 'uuid';
  /** The resolver name that tells the backend how to look up and format this UUID. */
  resolver: string;
  pre?: string;
  after?: string;
}

/**
 * Variables allowed in system instruction blocks.
 */
export type SystemVariable = EnumVariable | NumberVariable | UuidVariable;

/**
 * Variables allowed in user instruction blocks (superset of system variables).
 */
export type UserVariable = SystemVariable | StringVariable | StringArrayVariable;

/**
 * A block of prompt text with typed template variables.
 */
export interface InstructionBlock<V> {
  prompt: string;
  variables?: Record<string, V>;
}

/**
 * A complete prompt definition uploaded to the backend during release.
 */
export interface PromptDefinition {
  name: string;
  systemInstructions?: InstructionBlock<SystemVariable>;
  userInstructions?: InstructionBlock<UserVariable>;
  schema?: Record<string, any>;
  tools?: any[];
  model?: string;
}
