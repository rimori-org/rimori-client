export const languageKeys = {
  sq: "albanian",
  ar: "arabic",
  hy: "armenian",
  az: "azerbaijani",
  bn: "bengali",
  bs: "bosnian",
  bg: "bulgarian",
  ca: "catalan",
  zh: "chinese",
  hr: "croatian",
  cs: "czech",
  da: "danish",
  nl: "dutch",
  en: "english",
  et: "estonian",
  fi: "finnish",
  fr: "french",
  gl: "galician",
  de: "german",
  el: "greek",
  he: "hebrew",
  hi: "hindi",
  hu: "hungarian",
  is: "icelandic",
  id: "indonesian",
  it: "italian",
  ja: "japanese",
  kn: "kannada",
  kk: "kazakh",
  ko: "korean",
  lv: "latvian",
  lt: "lithuanian",
  mk: "macedonian",
  ms: "malay",
  mr: "marathi",
  mi: "maori",
  ne: "nepali",
  no: "norwegian",
  fa: "persian",
  pl: "polish",
  pt: "portuguese",
  ro: "romanian",
  ru: "russian",
  sr: "serbian",
  sk: "slovak",
  sl: "slovenian",
  es: "spanish",
  sw: "swahili",
  sv: "swedish",
  tl: "filipino",
  ta: "tamil",
  th: "thai",
  tr: "turkish",
  uk: "ukrainian",
  ur: "urdu",
  vi: "vietnamese",
  cy: "welsh"
} as const;

export type Language = keyof typeof languageKeys;

/**
 * Get the language name from the language code
 * @param languageCode The code of the language
 * @param capitalize Whether to capitalize the first letter of the language name
 * @returns The language name
 */
export function getLanguageName(languageCode: Language, capitalize: boolean = false): string {
  const lang = languageKeys[languageCode];
  return capitalize ? lang.charAt(0).toUpperCase() + lang.slice(1) : lang;
}