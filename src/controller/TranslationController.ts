import { createInstance, ThirdPartyModule, TOptions, i18n as i18nType } from 'i18next';
import { ObjectRequest } from './ObjectController';
import { AIModule } from '../plugin/module/AIModule';

export type AIObjectGenerator = <T>(request: ObjectRequest) => Promise<T>;

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
  private aiTranslationInFlight = new Set<string>();

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
   * Get translation for a key or freeform text. If the key is not a valid translation key, the freeform text is translated using AI and cached.
   * @param key - Translation key or freeform text
   * @param options - Translation options
   * @returns Translated string
   */
  t(key: string, options?: TOptions): string {
    if (!this.isTranslationKey(key)) {
      return this.translateFreeformText(key);
    }

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

  private isTranslationKey(key: string): boolean {
    return /^[^\s.]+(\.[^\s.]+)+$/.test(key);
  }

  private translateFreeformText(text: string): string {
    const cached = this.aiTranslationCache.get(text);
    if (cached) return cached;

    if (!this.ai || this.aiTranslationInFlight.has(text)) {
      return text;
    }

    this.aiTranslationInFlight.add(text);
    void this.fetchTranslation(text).finally(() => {
      this.aiTranslationInFlight.delete(text);
    });

    return text;
  }

  async fetchTranslation(text: string, additionalInstructions?: string): Promise<string> {
    const cached = this.aiTranslationCache.get(text);
    if (cached) return cached;
    try {
      if (!this.ai) return text;
      const response = await this.ai.getObject<{ translation: string }>({
        behaviour: 'You are a translation engine. Return only the translated text.' + additionalInstructions,
        instructions: `Translate the following text into ${this.currentLanguage}: ${text}`,
        tool: {
          translation: {
            type: 'string',
            description: `The translation of the input text into ${this.currentLanguage}.`,
          },
        },
      });

      const translation = response?.translation;
      if (translation) {
        this.aiTranslationCache.set(text, translation);
        return translation;
      }
    } catch (error) {
      console.warn('Failed to translate freeform text:', { text, error });
    }
    return text;
  }
}
