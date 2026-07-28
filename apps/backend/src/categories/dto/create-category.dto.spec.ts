import { validate } from "class-validator";

import { CreateCategoryDto } from "./create-category.dto";

async function validateIcon(icon: string) {
  const dto = Object.assign(new CreateCategoryDto(), { name: "Test", icon });
  return validate(dto);
}

describe("CreateCategoryDto icon validation", () => {
  it.each(["🛒", "👨‍👩‍👧‍👦", "🇺🇸"])("accepts the single emoji %s", async (icon) => {
    await expect(validateIcon(icon)).resolves.toHaveLength(0);
  });

  it.each(["ab", "🛒🚌", "a"])("rejects %s", async (icon) => {
    const errors = await validateIcon(icon);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.constraints).toMatchObject({
      isSingleEmoji: "icon must be a single emoji",
    });
  });
});
