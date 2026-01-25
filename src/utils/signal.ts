type Signal<T> = {
  get(): T
  set(next: T | ((prev: T) => T)): void
}

export function signal<T>(initial: T): Signal<T> {
  let value = initial
  const get = () => value
  const set = (next: T | ((prev: T) => T)) => {
    const nextValue = typeof next === "function" ? (next as (p: T) => T)(value) : next
    if (!Object.is(value, nextValue)) {
      value = nextValue
    }
  }
  return { get, set }
}

// https://dev.to/luciano0322/two-javascript-fundamentals-you-need-before-implementing-signals-3pcn

/* Usage example:

const { get: count, set: setCount } = signal(0);
setCount(count() + 1);

*/
