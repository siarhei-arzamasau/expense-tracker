import {
  registerDecorator,
  type ValidationOptions,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from "class-validator";

@ValidatorConstraint({ name: "isSingleEmoji", async: false })
export class IsSingleEmojiConstraint implements ValidatorConstraintInterface {
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

  defaultMessage(): string {
    return "icon must be a single emoji";
  }
}

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
