const codes = ["Pre-A1", "A1", "A2", "B1", "B2", "C1", "C2", "Post-C2"];

export type LanguageLevel = "Pre-A1" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "Post-C2";

export function getDifficultyLevel(difficulty: LanguageLevel): number {
    return codes.indexOf(difficulty) + 1;
}

export function getDifficultyLabel(difficulty: number): LanguageLevel {
    return codes[difficulty] as LanguageLevel;
}
