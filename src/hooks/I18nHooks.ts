import { TOptions } from 'i18next';
import { useEffect, useState } from 'react';
import { Translator } from '../plugin/TranslationController';
import { useRimori } from '../providers/PluginProvider';

type TranslatorFn = (key: string, options?: TOptions) => string;

/**
 * Custom useTranslation hook that provides a translation function and indicates readiness
 * @returns An object containing the translation function (`t`) and a boolean (`ready`) indicating if the translator is initialized.
 */
export function useTranslation(): { t: TranslatorFn; ready: boolean } {
  const { plugin } = useRimori();
  const [translatorInstance, setTranslatorInstance] = useState<Translator | null>(null);

  useEffect(() => {
    void plugin.getTranslator().then(setTranslatorInstance);
  }, [plugin]);

  const safeT = (key: string, options?: TOptions): string => {
    // return zero-width space if translator is not initialized to keep text space occupied
    if (!translatorInstance) return '\u200B'; // zero-width space

    try {
      return translatorInstance.t(key, options);
    } catch (error) {
      console.error('Translation error:', error);
      return key;
    }
  };

  return { t: safeT, ready: translatorInstance !== null };
}
