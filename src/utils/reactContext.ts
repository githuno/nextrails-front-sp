// https://tylur.blog/react-hook-factory/

import { createContext, useContext, type Context, type Provider } from "react"

export interface CreateContextOptions<T> {
  name?: string
  defaultValue?: T
  onError?: (error: Error) => void
}

export function createSafeContext<T>(options: CreateContextOptions<T> = {}) {
  const { name = "Context", defaultValue = null } = options

  const Context = createContext<T | null>(defaultValue)

  const useContextValue = () => {
    const value = useContext(Context)
    if (value === null) {
      throw new Error(`${name}のProviderが見つからないよ！ちゃんとProviderで囲んでね！`)
    }
    return value
  }

  return [Context, useContextValue] as const
}
/**
 * 使用例

// ユーザー情報のコンテキストを作成
interface UserContext {
  name: string;
  email: string;
}

const [UserContext, useUser] = createSafeContext<UserContext>({
  name: 'UserContext'
});

// コンポーネントでの使用
function UserProfile() {
  const user = useUser();
  return (
    <div>
      <p>名前: {user.name}</p>
      <p>メール: {user.email}</p>
    </div>
  );
}

 * 
 */

export interface CreateContextResult<T> {
  Context: Context<T | null>
  useContext: () => T
  Provider: Provider<T | null>
}

export function createEnhancedContext<T>(options: CreateContextOptions<T> = {}): CreateContextResult<T> {
  const { name = "Context", defaultValue = null, onError = (error) => console.error(error) } = options

  const Context = createContext<T | null>(defaultValue)
  Context.displayName = name

  const useContextValue = () => {
    const value = useContext(Context)
    if (value === null) {
      const error = new Error(`${name}のProviderが見つからないよ！ちゃんとProviderで囲んでね！`)
      onError(error)
      throw error
    }
    return value
  }

  return {
    Context,
    useContext: useContextValue,
    Provider: Context.Provider,
  }
}

/**
 * 使用例
 * 

// テーマのコンテキストを作成
interface ThemeContext {
  primaryColor: string;
  isDark: boolean;
}

const {
  Context: ThemeContext,
  useContext: useTheme,
  Provider: ThemeProvider
} = createEnhancedContext<ThemeContext>({
  name: 'ThemeContext',
  onError: (error) => {
    // エラーハンドリングのカスタマイズ
    console.error('テーマのエラー:', error);
  }
});

// コンポーネントでの使用
function ThemedButton() {
  const theme = useTheme();
  return (
    <button style={{ backgroundColor: theme.primaryColor }}>
      {theme.isDark ? '🌙' : '☀️'}
    </button>
  );
}

 * 
 */
