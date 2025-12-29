// バリデーターのインターフェース定義
export interface Validator<T> {
  validate(data: unknown): { success: boolean; data: T }
}

// シンプルなデフォルトバリデーター
export class SimpleValidator<T> implements Validator<T> {
  constructor(private readonly shape: Record<keyof T, any>) {}

  validate(data: unknown): { success: boolean; data: T } {
    if (typeof data !== "object" || data === null) {
      return { success: false, data: {} as T }
    }

    const result = {} as T
    let isValid = true

    for (const [key, type] of Object.entries(this.shape)) {
      const value = (data as any)[key]
      if (typeof value !== type) {
        isValid = false
        break
      }
      result[key as keyof T] = value
    }

    return {
      success: isValid,
      data: isValid ? result : ({} as T),
    }
  }
}

// Zodバリデーターのラッパー
export class ZodValidator<T> implements Validator<T> {
  constructor(private readonly schema: any) {}

  validate(data: unknown): { success: boolean; data: T } {
    const result = this.schema.safeParse(data)
    return {
      success: result.success,
      data: result.success ? result.data : ({} as T),
    }
  }
}

// メインの検証関数
export function validate<T>(data: unknown, validator: Validator<T> | Record<keyof T, any>, fallback: T): T {
  // シンプルなバリデーターの場合、自動的にSimpleValidatorを生成
  const actualValidator =
    "validate" in validator ? (validator as Validator<T>) : new SimpleValidator<T>(validator as Record<keyof T, any>)

  const result = actualValidator.validate(data)
  return result.success ? result.data : fallback
}

// 使用例
/*
// SimpleValidatorを使用する場合
const userShape = {
  name: 'string',
  age: 'number'
};

const result = validate(
  { name: 'John', age: 30 },
  userShape,
  { name: '', age: 0 }
);

// カスタムバリデーターを使用する場合
class CustomValidator implements Validator<User> {
  validate(data: unknown) {
    // カスタム検証ロジック
  }
}

const result2 = validate(
  data,
  new CustomValidator(),
  defaultUser
);

// Zodを使用する場合
const result3 = validate(
  data,
  new ZodValidator(zodSchema),
  defaultUser
);

*/
