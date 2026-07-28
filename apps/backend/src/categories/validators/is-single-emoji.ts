import {
  registerDecorator,
  type ValidationOptions,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from "class-validator";

/**
 * Synchronous validator for one emoji grapheme cluster.
 *
 * Emoji may contain several UTF-16 code units joined into one visible symbol,
 * so string length cannot enforce this rule. Regional indicators are included
 * explicitly because flag emoji are not `Extended_Pictographic`.
 */
@ValidatorConstraint({ name: "isSingleEmoji", async: false })
export class IsSingleEmojiConstraint implements ValidatorConstraintInterface {
  /**
   * Checks that the value is exactly one grapheme containing an emoji code point.
   *
   * @param value - Candidate property value from class-validator.
   * @returns `true` only for a non-empty string containing one accepted emoji grapheme.
   */
  validate(value: unknown): boolean {
    if (typeof value !== "string" || value.length === 0 || value.length > 32) {
      return false;
    }

    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    const graphemes = [...segmenter.segment(value)];

    return (
      graphemes.length === 1 && /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(value)
    );
  }

  /** @returns The validation message exposed by the global `ValidationPipe`. */
  defaultMessage(): string {
    return "icon must be a single emoji";
  }
}

/**
 * Marks a DTO property as requiring one emoji grapheme cluster.
 *
 * @param options - Standard class-validator message and grouping options.
 * @returns A property decorator backed by `IsSingleEmojiConstraint`.
 */
export function IsSingleEmoji(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options,
      validator: IsSingleEmojiConstraint,
    });
  };
}
