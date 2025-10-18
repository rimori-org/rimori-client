import fs from 'fs';

/**
 * Detect available translation languages from public/locales directory
 * @returns Promise<string[]> Array of language codes found in the locales directory
 */
export async function detectTranslationLanguages(): Promise<string[]> {
  const localesPath = './public/locales';

  try {
    await fs.promises.access(localesPath);
  } catch (e) {
    console.log('⚠️ No locales directory found, no translations available');
    return [];
  }

  try {
    const files = await fs.promises.readdir(localesPath);

    // Filter out local- files and only include .json files
    const translationFiles = files.filter((file) => file.endsWith('.json') && !file.startsWith('local-'));

    if (translationFiles.length === 0) {
      console.log('⚠️ No translation files found (excluding local- files)');
      return [];
    }

    // Extract language codes from filenames (e.g., en.json -> en)
    const languages = translationFiles.map((file) => file.replace('.json', ''));

    console.log(`🌐 Found ${languages.length} translation languages: ${languages.join(', ')}`);
    return languages;
  } catch (error: any) {
    console.error(`❌ Error reading locales directory:`, error.message);
    return [];
  }
}
