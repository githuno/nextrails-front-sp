/**
 * オブジェクト操作ユーティリティ
 *
 * 差分計算、クローン作成、比較などの機能を提供する統合モジュール
 */

/**
 * データの深いクローンを作成
 * ブラウザの structuredClone をサポートしている場合はそれを使用
 * @param data クローン対象のデータ
 * @param cache 循環参照対策のキャッシュ（内部使用）
 */
function deepClone<T>(data: T, cache = new WeakMap<object, any>()): T {
  // null または undefined の場合はそのまま返す
  // オブジェクトでない場合はそのまま返す
  if (data == null || typeof data !== "object") return data;

  // 循環参照のチェック
  if (cache.has(data as object)) {
    return cache.get(data as object);
  }

  try {
    if (typeof window !== "undefined" && "structuredClone" in window) {
      return window.structuredClone(data);
    }
  } catch (e) {
    console.warn(
      "structuredCloneが失敗しました、フォールバックを使用します",
      e
    );
  }

  let result: any;

  // 特殊なオブジェクトの処理
  if (data instanceof Date) {
    result = new Date(data.getTime());
  } else if (data instanceof Map) {
    result = new Map();
    cache.set(data as object, result);
    for (const [k, v] of Array.from(data.entries())) {
      result.set(k, deepClone(v, cache));
    }
  } else if (data instanceof Set) {
    result = new Set();
    cache.set(data as object, result);
    for (const item of Array.from(data)) {
      result.add(deepClone(item, cache));
    }
  } else if (Array.isArray(data)) {
    result = [];
    cache.set(data as object, result);
    for (let i = 0; i < data.length; i++) {
      result[i] = deepClone(data[i], cache);
    }
  } else {
    // 一般のオブジェクト
    result = Object.create(Object.getPrototypeOf(data));
    cache.set(data as object, result);
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        result[key] = deepClone((data as any)[key], cache);
      }
    }
  }

  return result as T;
}

/**
 * 特定のパスのプロパティのみをディープクローン
 * @param obj 対象オブジェクト
 * @param paths クローンするプロパティパスの配列（例: ['user.name', 'user.email']）
 */
function selectiveDeepClone<T extends Record<string, any>>(
  obj: T,
  paths: string[]
): Partial<T> {
  const result: Partial<T> = {};
  for (const path of paths) {
    const parts = path.split(".");
    let current = obj;
    let target = result;

    // 最後のパーツ以外を処理
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (current[part] === undefined) break;

      current = current[part];
      if (!target[part]) {
        (target as Record<string, any>)[part] = {} as any;
      }
      target = target[part] as any;
    }

    // 最後のパーツを処理
    const lastPart = parts[parts.length - 1];
    if (current[lastPart] !== undefined) {
      (target as any)[lastPart] = deepClone(current[lastPart]);
    }
  }
  return result;
}

/**
 * 2つの値が等しいかを深く比較
 * @param a 比較対象1
 * @param b 比較対象2
 */
function isEqual(a: any, b: any, visited = new WeakMap()): boolean {
  // プリミティブな比較
  if (a === b) return true;

  // 型チェック
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  // オブジェクト型のみ深く比較
  if (typeof a === "object") {
    // 循環参照チェック
    if (visited.has(a)) {
      return visited.get(a) === b;
    }
    visited.set(a, b);

    // 配列の比較
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!isEqual(a[i], b[i], visited)) return false;
      }
      return true;
    }

    // 特殊なオブジェクトタイプの比較
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    if (a instanceof Map && b instanceof Map) {
      if (a.size !== b.size) return false;
      for (const [key, val] of Array.from(a.entries())) {
        if (!b.has(key) || !isEqual(val, b.get(key), visited)) return false;
      }
      return true;
    }

    if (a instanceof Set && b instanceof Set) {
      if (a.size !== b.size) return false;
      for (const item of Array.from(a)) {
        // Setの場合は厳密な比較が難しいので、含まれるかどうかを確認
        let found = false;
        for (const bItem of Array.from(b)) {
          if (isEqual(item, bItem, visited)) {
            found = true;
            break;
          }
        }
        if (!found) return false;
      }
      return true;
    }

    // 一般オブジェクトの比較
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key) || !isEqual(a[key], b[key], visited)) {
        return false;
      }
    }

    return true;
  }

  return false;
}

/**
 * 2つのオブジェクト間の差分を計算
 * @param oldObj 元のオブジェクト
 * @param newObj 新しいオブジェクト
 * @returns 差分オブジェクト
 */
function computeDiff(oldObj: any, newObj: any): { [key: string]: any } {
  if (
    typeof oldObj !== "object" ||
    typeof newObj !== "object" ||
    oldObj === null ||
    newObj === null
  ) {
    return newObj; // オブジェクトでない場合は完全に置き換え
  }

  const diff: { [key: string]: any } = {};

  // 変更と追加を検出
  for (const key in newObj) {
    // 値が存在しない、または異なる場合
    if (!(key in oldObj) || !isEqual(oldObj[key], newObj[key])) {
      if (
        typeof newObj[key] === "object" &&
        newObj[key] !== null &&
        typeof oldObj[key] === "object" &&
        oldObj[key] !== null
      ) {
        // 再帰的に差分を計算
        const nestedDiff = computeDiff(oldObj[key], newObj[key]);
        if (Object.keys(nestedDiff).length > 0) {
          diff[key] = nestedDiff;
        }
      } else {
        diff[key] = newObj[key];
      }
    }
  }

  // 削除を検出
  for (const key in oldObj) {
    if (!(key in newObj)) {
      diff[key] = undefined; // 削除されたプロパティを示す
    }
  }

  return diff;
}

// 単純なハッシュ計算関数の例
function computeStateHash(state: any): string {
  try {
    // 小さな状態だけサンプリング
    const sample = JSON.stringify(objUt.pick(state, Object.keys(state).slice(0, 5)));
    return sample.length + ':' + sample.slice(0, 50);
  } catch (e) {
    return Date.now().toString();
  }
}

/**
 * 差分を適用して新しいオブジェクトを生成
 * @param base ベースとなるオブジェクト
 * @param diff 適用する差分
 * @returns 新しいオブジェクト
 */
function applyDiff(base: any, diff: { [key: string]: any }): any {
  if (diff === null || typeof diff !== "object") return diff;

  const result = Array.isArray(base) ? [...base] : { ...base };

  for (const key in diff) {
    const value = diff[key];

    if (value === undefined) {
      // 削除されたプロパティ
      delete result[key];
    } else if (
      typeof value === "object" &&
      value !== null &&
      typeof result[key] === "object" &&
      result[key] !== null
    ) {
      // ネストされたオブジェクトは再帰的に処理
      result[key] = applyDiff(result[key], value);
    } else {
      // プリミティブ値または完全に新しいオブジェクト
      result[key] = value;
    }
  }

  return result;
}

/**
 * オブジェクトからパスに基づいて値を取得
 * @param obj 対象オブジェクト
 * @param path 取得するプロパティのパス（ドット区切り）
 */
function getByPath(obj: any, path: string): any {
  const keys = path.split(".");
  return keys.reduce(
    (o, key) => (o && o[key] !== undefined ? o[key] : undefined),
    obj
  );
}

/**
 * オブジェクトのパスに値を設定
 * @param obj 対象オブジェクト
 * @param path 設定するプロパティのパス（ドット区切り）
 * @param value 設定する値
 */
function setByPath(obj: any, path: string, value: any): any {
  const result = { ...obj };
  const keys = path.split(".");
  const lastKey = keys.pop()!;

  // 最後のキー以外のパスを構築
  const target = keys.reduce((o, key) => {
    if (!o[key] || typeof o[key] !== "object") {
      o[key] = {};
    }
    o[key] = { ...o[key] };
    return o[key];
  }, result);

  // 最後のキーに値を設定
  target[lastKey] = value;
  return result;
}

/**
 * 差分を抽出する（パスベース）
 * パスベースの差分は変更された具体的なパスの情報を提供する
 * @param oldObj 元のオブジェクト
 * @param newObj 新しいオブジェクト
 * @param prefix 現在のパスのプレフィックス（内部使用）
 */
function extractDiff(
  oldObj: any,
  newObj: any,
  prefix = ""
): Record<string, any> {
  const diff: Record<string, any> = {};

  // 新しいオブジェクトのすべてのキーをチェック
  for (const key in newObj) {
    const currentPath = prefix ? `${prefix}.${key}` : key;

    // キーが古いオブジェクトにない、または値が異なる場合
    if (!(key in oldObj) || !isEqual(oldObj[key], newObj[key])) {
      if (
        typeof newObj[key] === "object" &&
        newObj[key] !== null &&
        typeof oldObj[key] === "object" &&
        oldObj[key] !== null
      ) {
        // 両方がオブジェクトの場合は再帰的に差分を抽出
        const nestedDiff = extractDiff(oldObj[key], newObj[key], currentPath);
        Object.assign(diff, nestedDiff);
      } else {
        // それ以外の場合は直接値を保存
        diff[currentPath] = newObj[key];
      }
    }
  }

  // 古いオブジェクトにあって新しいオブジェクトにないキーを削除対象としてマーク
  for (const key in oldObj) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    if (!(key in newObj)) {
      diff[currentPath] = undefined; // 削除を表すためにundefinedを使用
    }
  }

  return diff;
}

/**
 * オブジェクトの差分を分析
 * @param oldObj 元のオブジェクト
 * @param newObj 新しいオブジェクト
 * @returns 差分情報
 */
function analyzeDiff(oldObj: any, newObj: any) {
  // 単一の走査ですべての情報を抽出
  const pathDiffs: Record<string, any> = {};
  const diff: Record<string, any> = {};
  const reverseDiff: Record<string, any> = {};

  // オブジェクト構造を一度だけ走査
  const processLevel = (
    oldLevel: any,
    newLevel: any,
    path: string = "",
    visited = new WeakMap()
  ) => {
    // 循環参照防止
    if (typeof oldLevel === "object" && oldLevel !== null) {
      if (visited.has(oldLevel)) return;
      visited.set(oldLevel, true);
    }

    // 同じオブジェクト参照なら何もしない
    if (oldLevel === newLevel) return;

    // プリミティブ値の比較
    if (
      typeof oldLevel !== "object" ||
      typeof newLevel !== "object" ||
      oldLevel === null ||
      newLevel === null
    ) {
      if (oldLevel !== newLevel) {
        pathDiffs[path] = newLevel;
        diff[path] = newLevel;
        reverseDiff[path] = oldLevel;
      }
      return;
    }

    // キーの集合を取得
    const allKeys = new Set([
      ...Object.keys(oldLevel),
      ...Object.keys(newLevel),
    ]);

    // 各キーを処理
    for (const key of Array.from(allKeys)) {
      const currentPath = path ? `${path}.${key}` : key;
      const oldValue = oldLevel[key];
      const newValue = newLevel[key];

      // 値が存在しないケース
      if (!(key in oldLevel)) {
        pathDiffs[currentPath] = newValue;
        diff[currentPath] = newValue;
        continue;
      }

      if (!(key in newLevel)) {
        pathDiffs[currentPath] = undefined;
        diff[currentPath] = undefined;
        reverseDiff[currentPath] = oldValue;
        continue;
      }

      // 再帰的に処理
      processLevel(oldValue, newValue, currentPath, visited);
    }
  };

  processLevel(oldObj, newObj);

  return { pathDiffs, diff, reverseDiff };
}

/**
 * オブジェクトの安全な浅いマージ
 * 第一引数を修正せず、新しいオブジェクトを返す
 * @param target ベースとなるオブジェクト
 * @param source マージするオブジェクト
 */
function merge<T extends Record<string, any>, S extends Record<string, any>>(
  target: T,
  source: S
): T & S {
  return { ...target, ...source };
}

/**
 * オブジェクトを整理して特定のプロパティのみを抽出
 * @param obj 対象オブジェクト
 * @param keys 抽出するキーの配列
 */
function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result as Pick<T, K>;
}

/**
 * オブジェクトを整理して特定のプロパティを除外
 * @param obj 対象オブジェクト
 * @param keys 除外するキーの配列
 */
function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

export const objUt = {
  deepClone,
  selectiveDeepClone,
  isEqual,
  computeDiff,
  computeStateHash,
  applyDiff,
  getByPath,
  setByPath,
  extractDiff,
  analyzeDiff,
  merge,
  pick,
  omit,
};
