const codes = ['Pre-A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Post-C2'];

export type LanguageLevel = 'Pre-A1' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'Post-C2';

export function getDifficultyLevel(difficulty: LanguageLevel): number {
  return codes.indexOf(difficulty) + 1;
}

export function getDifficultyLabel(difficulty: number): LanguageLevel {
  return codes[difficulty] as LanguageLevel;
}

export function getNeighborDifficultyLevel(difficulty: LanguageLevel, difficultyAdjustment: number): LanguageLevel {
  return getDifficultyLabel(getDifficultyLevel(difficulty) + difficultyAdjustment - 1);
}

/**
 * Compares two LanguageLevel values to determine their relative order.
 * Returns:
 * - negative number if level1 < level2
 * - 0 if level1 === level2
 * - positive number if level1 > level2
 */
export function compareLanguageLevels(level1: LanguageLevel, level2: LanguageLevel): number {
  return getDifficultyLevel(level1) - getDifficultyLevel(level2);
}
