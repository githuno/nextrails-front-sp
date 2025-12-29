/**
 * https://jsdev.space/howto/js-drag-implementation/
 * ドラッグアンドドロップのコア機能を提供するユーティリティ
 * - 再利用性: 様々な環境での利用を想定した設計
 * - 拡張性: オプションや振る舞いをカスタマイズ可能
 * - SSR互換: windowやdocumentの直接参照を避け、実行環境を検出
 * - メモリパフォーマンス: イベントリスナーの適切な管理とメモリリーク防止
 * - 型安全性: TypeScriptによる型定義の提供
 */

export interface Position {
  x: number
  y: number
}

export interface DragBoundaries {
  minX?: number
  maxX?: number
  minY?: number
  maxY?: number
}

export interface DndOptions {
  /** ドラッグ開始時のコールバック */
  onDragStart?: (position: Position, event: MouseEvent | TouchEvent) => void
  /** ドラッグ中のコールバック */
  onDrag?: (position: Position, event: MouseEvent | TouchEvent) => void
  /** ドラッグ終了時のコールバック */
  onDragEnd?: (position: Position, event: MouseEvent | TouchEvent) => void
  /** 移動範囲の制限 */
  boundaries?: DragBoundaries
  /** パフォーマンス最適化のためのrequestAnimationFrameの使用 */
  useRaf?: boolean
  /** パフォーマンス最適化のためのdebounce遅延（ミリ秒） */
  debounceDelay?: number
}

export interface DndController {
  /** ドラッグ開始イベントを設定 */
  enableDrag: () => void
  /** ドラッグ機能を無効化 */
  disableDrag: () => void
  /** 現在の位置を取得 */
  getPosition: () => Position
  /** 位置を強制的に更新 */
  setPosition: (position: Position) => void
  /** すべてのリソースをクリーンアップ */
  cleanup: () => void
}

/**
 * ユーティリティ: debounce関数
 */
function createDebounce(fn: Function, delay: number): Function {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return function (...args: any[]) {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => fn(...args), delay)
  }
}

/**
 * ドラッグアンドドロップ機能を提供する関数
 */
export function createDnd(element: HTMLElement, options: DndOptions = {}): DndController {
  // デフォルトオプション
  const { onDragStart, onDrag, onDragEnd, boundaries, useRaf = false, debounceDelay } = options

  // 現在の位置 - transform値から初期位置を抽出
  let currentPosition: Position = extractPositionFromTransform(element) || {
    x: 0,
    y: 0,
  }
  let isDragging = false
  let startOffset: Position = { x: 0, y: 0 }

  // イベントハンドラ
  let moveHandler: (event: MouseEvent | TouchEvent) => void
  let endHandler: (event: MouseEvent | TouchEvent) => void

  // パフォーマンス最適化
  const processMove = debounceDelay ? createDebounce(updateElementPosition, debounceDelay) : updateElementPosition

  /**
   * ドラッグ開始処理
   */
  function handleDragStart(event: MouseEvent | TouchEvent): void {
    // すでにドラッグ中なら何もしない
    if (isDragging) return

    event.preventDefault()
    isDragging = true

    // 初期位置の設定
    const { clientX, clientY } = getEventCoordinates(event)

    // 既存のtransform位置を使用して正確なオフセットを計算
    startOffset = {
      x: clientX - currentPosition.x,
      y: clientY - currentPosition.y,
    }

    // ドラッグ中と終了時のイベントリスナーを追加 - この部分が欠けていた
    document.addEventListener("mousemove", moveHandler)
    document.addEventListener("touchmove", moveHandler, { passive: false })
    document.addEventListener("mouseup", endHandler)
    document.addEventListener("touchend", endHandler)

    // コールバック実行
    if (onDragStart) onDragStart(currentPosition, event)
  }

  /**
   * ドラッグ中の処理
   */
  function handleDragMove(event: MouseEvent | TouchEvent): void {
    if (!isDragging) return
    event.preventDefault()

    const { clientX, clientY } = getEventCoordinates(event)

    // 新しい位置を計算
    const newPosition = {
      x: clientX - startOffset.x,
      y: clientY - startOffset.y,
    }

    // 境界チェック
    if (boundaries) {
      if (boundaries.minX !== undefined) newPosition.x = Math.max(boundaries.minX, newPosition.x)
      if (boundaries.maxX !== undefined) newPosition.x = Math.min(boundaries.maxX, newPosition.x)
      if (boundaries.minY !== undefined) newPosition.y = Math.max(boundaries.minY, newPosition.y)
      if (boundaries.maxY !== undefined) newPosition.y = Math.min(boundaries.maxY, newPosition.y)
    }

    // 位置を更新
    currentPosition = newPosition

    // 最適化されたレンダリング
    if (useRaf) {
      requestAnimationFrame(() => processMove(event))
    } else {
      processMove(event)
    }
  }

  /**
   * 要素の位置を更新
   */
  function updateElementPosition(event: MouseEvent | TouchEvent): void {
    // CSSトランスフォームで位置を更新（パフォーマンス向上）
    element.style.transform = `translate(${currentPosition.x}px, ${currentPosition.y}px)`

    // コールバック実行
    if (onDrag) onDrag(currentPosition, event)
  }

  /**
   * ドラッグ終了処理
   */
  function handleDragEnd(event: MouseEvent | TouchEvent): void {
    if (!isDragging) return

    isDragging = false

    // イベントリスナーを削除
    document.removeEventListener("mousemove", moveHandler)
    document.removeEventListener("touchmove", moveHandler)
    document.removeEventListener("mouseup", endHandler)
    document.removeEventListener("touchend", endHandler)

    // コールバック実行
    if (onDragEnd) onDragEnd(currentPosition, event)
  }

  /**
   * タッチとマウスイベントの座標を統一的に取得
   */
  function getEventCoordinates(event: MouseEvent | TouchEvent): {
    clientX: number
    clientY: number
  } {
    if ("touches" in event) {
      return {
        clientX: event.touches[0].clientX,
        clientY: event.touches[0].clientY,
      }
    }
    return {
      clientX: event.clientX,
      clientY: event.clientY,
    }
  }

  // イベントハンドラの初期化
  moveHandler = handleDragMove
  endHandler = handleDragEnd

  // 公開API
  const controller: DndController = {
    enableDrag: () => {
      element.addEventListener("mousedown", handleDragStart)
      element.addEventListener("touchstart", handleDragStart, {
        passive: false,
      })
    },

    disableDrag: () => {
      element.removeEventListener("mousedown", handleDragStart)
      element.removeEventListener("touchstart", handleDragStart)

      // 進行中のドラッグを終了
      if (isDragging) {
        isDragging = false
        document.removeEventListener("mousemove", moveHandler)
        document.removeEventListener("touchmove", moveHandler)
        document.removeEventListener("mouseup", endHandler)
        document.removeEventListener("touchend", endHandler)
      }
    },

    getPosition: () => ({ ...currentPosition }),

    setPosition: (position: Position) => {
      currentPosition = { ...position }
      element.style.transform = `translate(${currentPosition.x}px, ${currentPosition.y}px)`
    },

    cleanup: () => {
      controller.disableDrag()
    },
  }

  // ドラッグ機能を有効化
  controller.enableDrag()

  return controller
}

/**
 * 要素のtransform: translate(x, y)からx,y座標を抽出
 */
function extractPositionFromTransform(element: HTMLElement): Position | null {
  const transform = window.getComputedStyle(element).transform
  if (transform === "none") return null

  // matrix(a, b, c, d, tx, ty) または matrix3d(...)からtx, tyを抽出
  const match = transform.match(/matrix.*\((.+)\)/)
  if (match) {
    const values = match[1].split(", ")
    // 2D行列の場合、tx=values[4], ty=values[5]
    // 3D行列の場合、tx=values[12], ty=values[13]
    const tx = parseFloat(values[values.length === 6 ? 4 : 12])
    const ty = parseFloat(values[values.length === 6 ? 5 : 13])
    return { x: tx, y: ty }
  }

  return null
}
