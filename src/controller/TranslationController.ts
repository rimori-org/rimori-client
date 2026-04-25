import { createInstance, ThirdPartyModule, i18n as i18nType, TOptions } from 'i18next';
import { AIModule } from '../plugin/module/AIModule';

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
  private ai: AIModule;
  private aiTranslationCache = new Map<string, string>();
  private aiTranslationPending = new Map<string, Promise<string>>();

  constructor(initialLanguage: string, translationUrl: string, ai: AIModule) {
    this.currentLanguage = initialLanguage;
    this.initializationState = 'not-inited';
    this.initializationPromise = null;
    this.translationUrl = translationUrl;
    this.ai = ai;
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
          debug: false,
          showSupportNotice: false,
          parseMissingKeyHandler: (key, defaultValue): string => {
            if (!key.trim()) return '';
            if (this.isTranslationKey(key)) {
              console.warn(`Translation key not found: ${key}`);
              return defaultValue ?? '';
            }
            void this.fetchTranslation(key).then((translation) => {
              this.i18n?.addResource(this.currentLanguage, 'translation', key, translation);
              this.i18n?.emit('languageChanged'); // triggers re-render
            });
            return key;
          },
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
    const baseUrl = (this.translationUrl || window.location.origin).replace(/\/+$/, '');

    return `${baseUrl}/locales/${language}.json`;
  }

  public usePlugin(plugin: ThirdPartyModule): void {
    if (!this.i18n) {
      throw new Error('Translator is not initialized');
    }
    this.i18n.use(plugin);
  }

  public onLanguageChanged(callback: () => void): void {
    if (!this.i18n) {
      throw new Error('Translator is not initialized');
    }
    this.i18n.on('languageChanged', callback);
  }

  /**
   * Fetch translations manually from the current domain
   * @param language - Language code to fetch
   * @returns Promise with translation data
   */
  private async fetchTranslations(language: string, attempt = 0): Promise<Record<string, string>> {
    try {
      const response = await fetch(this.getTranslationUrl(language));
      if (!response.ok) {
        throw new Error(`Failed to fetch translations for ${language}: ${response.status}`);
      }
      const data = (await response.json()) as Record<string, unknown>;
      // If the result is empty, treat it as a failure and retry once to handle transient errors
      if (Object.keys(data).length === 0 && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return this.fetchTranslations(language, 1);
      }
      return data as Record<string, string>;
    } catch (error) {
      if (attempt === 0) {
        // Retry once after a short delay to handle transient network/CDN errors
        await new Promise((resolve) => setTimeout(resolve, 300));
        return this.fetchTranslations(language, 1);
      }
      console.warn(
        `Fetching of ${language} translation not possible. Falling back to english. Error details: ` +
          (error as Error).message,
      );
      if (language === 'en') return {};

      // Fallback to English
      return this.fetchTranslations('en').catch((fallbackError) => {
        console.error('Failed to fetch fallback translations:', fallbackError);
        return {};
      });
    }
  }

  /**
   * Get translation for a key or freeform text. If the key is not a valid translation key, the freeform text is translated using AI and cached.
   * @param key - Translation key or freeform text
   * @param options - Translation options
   * @returns Translated string
   */
  t(key: string, options?: TOptions): string {
    if (!this.i18n) {
      throw new Error('Translator is not initialized');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.i18n.t(key, options as any) as string;
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

  private isTranslationKey(key: string): boolean {
    return /^[^\s.]+(\.[^\s.]+)+$/.test(key);
  }

  async fetchTranslation(text: string, additionalInstructions?: string): Promise<string> {
    const cached = this.aiTranslationCache.get(text);
    if (cached) return cached;

    const pending = this.aiTranslationPending.get(text);
    if (pending) return pending;

    if (!this.ai || this.currentLanguage === 'en') return text;

    const promise = (async (): Promise<string> => {
      try {
        const response = await this.ai.getObject<{ translation: string }>({
          prompt: 'global.translator.translate',
          variables: {
            additionalInstructions: additionalInstructions ?? '',
            language: this.currentLanguage,
            text,
          },
          cache: true,
        });

        const translation = response?.translation;
        if (translation) {
          this.aiTranslationCache.set(text, translation);
          return translation;
        }
      } catch (error) {
        console.warn('Failed to translate freeform text:', { text, error });
      } finally {
        this.aiTranslationPending.delete(text);
      }
      return text;
    })();

    this.aiTranslationPending.set(text, promise);
    return promise;
  }
}
