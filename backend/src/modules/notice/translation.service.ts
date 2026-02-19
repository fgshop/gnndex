import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type TranslatedContent = {
  title: string;
  summary: string;
  content: string;
};

export type TranslationsMap = Record<string, TranslatedContent>;

const TARGET_LANGUAGES = ["en", "fr", "es", "it", "de", "zh", "ja", "th", "vi", "id", "ru"];

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly apiKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>("GOOGLE_TRANSLATE_API_KEY");
  }

  async translateNoticeContent(
    title: string,
    summary: string,
    content: string
  ): Promise<TranslationsMap> {
    if (!this.apiKey) {
      this.logger.warn("GOOGLE_TRANSLATE_API_KEY not set, skipping translation");
      return {};
    }

    const translations: TranslationsMap = {};

    for (const lang of TARGET_LANGUAGES) {
      try {
        const [translatedTitle, translatedSummary, translatedContent] = await Promise.all([
          this.translate(title, lang),
          this.translate(summary, lang),
          this.translate(content, lang)
        ]);

        translations[lang] = {
          title: translatedTitle,
          summary: translatedSummary,
          content: translatedContent
        };
      } catch (error) {
        this.logger.error(`Failed to translate to ${lang}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return translations;
  }

  private async translate(text: string, targetLang: string): Promise<string> {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "ko",
        target: targetLang,
        format: "text"
      })
    });

    if (!response.ok) {
      throw new Error(`Google Translate API returned ${response.status}`);
    }

    const data = (await response.json()) as {
      data?: { translations?: Array<{ translatedText?: string }> };
    };

    return data.data?.translations?.[0]?.translatedText ?? text;
  }
}
