import { createInstance, ThirdPartyModule, TOptions, i18n as i18nType } from 'i18next';

type InitializationState = 'not-inited' | 'initing' | 'finished';

/**
 * Translator class for handling internationalization
 */
export class Translator {
  private currentLanguage: string;
  private initializationState: InitializationState;
  private initializationPromise: Promise<void> | null;
  private i18n: i18nType | undefined;
  private translationUrl: string;

  constructor(initialLanguage: string, translationUrl: string) {
    this.currentLanguage = initialLanguage;
    this.initializationState = 'not-inited';
    this.initializationPromise = null;
    this.translationUrl = translationUrl;
  }

  /**
   * Initialize translator with user's language
   * @param userLanguage - Language code from user info
   */
  async initialize(): Promise<void> {
    // If already finished, return immediately
    if (this.initializationState === 'finished') {
      return;
    }

    // If currently initializing, wait for the existing initialization to complete
    if (this.initializationState === 'initing' && this.initializationPromise) {
      return this.initializationPromise;
    }

    // Start initialization
    this.initializationState = 'initing';

    // Create a promise that will be resolved when initialization completes
    this.initializationPromise = (async (): Promise<void> => {
      try {
        const translations = await this.fetchTranslations(this.currentLanguage);

        const instance = createInstance({
          lng: this.currentLanguage,
          resources: {
            [this.currentLanguage]: {
              translation: translations,
            },
          },
          debug: window.location.hostname === 'localhost',
        });

        await instance.init();
        this.i18n = instance;
        this.initializationState = 'finished';
      } catch (error) {
        // Reset state on error so it can be retried
        this.initializationState = 'not-inited';
        this.initializationPromise = null;
        throw error;
      }
    })();

    return this.initializationPromise;
  }

  private getTranslationUrl(language: string): string {
    // For localhost development, use local- prefix for non-English languages
    if (window.location.hostname === 'localhost') {
      const filename = language !== 'en' ? `local-${language}` : language;

      return `${window.location.origin}/locales/${filename}.json`;
    }

    return `${this.translationUrl}/locales/${language}.json`;
  }

  public usePlugin(plugin: ThirdPartyModule): void {
    if (!this.i18n) {
      throw new Error('Translator is not initialized');
    }
    this.i18n.use(plugin);
  }
  /**
   * Fetch translations manually from the current domain
   * @param language - Language code to fetch
   * @returns Promise with translation data
   */
  private async fetchTranslations(language: string): Promise<Record<string, string>> {
    try {
      const response = await fetch(this.getTranslationUrl(language));
      if (!response.ok) {
        throw new Error(`Failed to fetch translations for ${language}`);
      }
      return (await response.json()) as Record<string, string>;
    } catch (error) {
      console.warn(`Failed to fetch translations for ${language}:`, error);
      if (language === 'en') return {};

      // Fallback to English
      return this.fetchTranslations('en').catch((error) => {
        console.error('Failed to fetch fallback translations:', error);
        return {};
      });
    }
  }

  /**
   * Get translation for a key
   * @param key - Translation key
   * @param options - Translation options
   * @returns Translated string
   */
  t(key: string, options?: TOptions): string {
    if (!this.i18n) {
      throw new Error('Translator is not initialized');
    }
    return this.i18n.t(key, options) as string;
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): string {
    return this.currentLanguage;
  }

  /**
   * Check if translator is initialized
   */
  isReady(): boolean {
    return this.initializationState === 'finished';
  }
}
