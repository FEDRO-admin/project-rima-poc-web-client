import { Language } from '../../i18n/language';
import { FatalError } from '../../error-handling/base-error';

export class WebmapLanguageCategoryMissingError extends FatalError {
  public override message = 'No portal category mapping found for language';
  public override translationArguments: Record<'language', string>;

  constructor(language: Language) {
    super();
    this.translationArguments = { language };
  }
}
