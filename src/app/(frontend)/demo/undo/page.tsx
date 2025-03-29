"use client";

import React, { useRef, useState, useEffect } from "react";
import { useEfficientUndo } from "@/hooks/useUndo";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

interface DrawingState {
  strokes: Stroke[];
  currentColor: string;
  currentWidth: number;
}

const DrawingPage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [showDetails, setShowDetails] = useState(false);

  // Undoフックを使用して描画状態を管理
  const {
    // 基本的な状態と操作
    state: drawing, // 現在の状態
    setState: setDrawing, // 状態を更新する関数 (通常のsetState + ラベル + サイレントモード)
    // updateState,          // 部分的に状態を更新（オブジェクト用）
    undo, // 最後の操作を元に戻す
    redo, // 元に戻した操作をやり直す
    canUndo, // アンドゥ可能かどうか
    canRedo, // リドゥ可能かどうか
    clear, // 履歴をクリア

    // 拡張機能
    history, // 表示用の履歴配列 [{index, label}]
    // historyState,         // 履歴の状態情報 {past, future, canUndo, canRedo, lastOperation}
    undoTo, // 特定のインデックスまでアンドゥ
    undoUntil, // 特定のラベルまでアンドゥ

    // バッチ処理とアクション作成
    batch, // 複数の操作をまとめて一つのアンドゥステップとする
    // createAction,         // カスタムアンドゥ可能なアクションを作成
    // createDiffAction,     // 差分ベースのアクションを作成

    // 高度な操作用
    // getRawHistory,        // 生の履歴データを取得（内部構造）
    // rebuild,              // 履歴スタックを保持したまま初期状態を変更
    getMemoryUsage, // メモリ使用量に関する情報を取得

    // パフォーマンス最適化のためのメモ化された値
    // stack,                // 内部アンドゥスタックへの直接参照（高度な操作用）
  } = useEfficientUndo<DrawingState>(
    {
      // 初期状態
      strokes: [],
      currentColor: "#000000",
      currentWidth: 3,
    },
    {
      // 基本オプション
      debug: true, // デバッグモード（コンソールログを出力）
      performanceMonitoring: true, // パフォーマンス監視を有効化
      enableKeyboardShortcuts: true, // Ctrl+Z/Ctrl+Yキーボードショートカット

      // アクション管理オプション
      compress: false, // 連続した同じラベルのアクションを圧縮するか(個々の線ごとに保存したいのでfalse)
      // historyLimit: 100,         // 履歴の最大数（デフォルト値）
      useDiff: false, // 差分ベースの状態管理（メモリ使用量を削減するが、描画などの複雑な操作とアクション履歴との同期が難しくなるためfalse）

      // メモリ最適化オプション
      // memoryEfficient: true,        // メモリ効率化を有効（内部最適化）
      // memoryBasedLimit: true,       // メモリ使用量に基づく履歴制限
      // maxMemorySize: 50,            // メモリ最大サイズ（MB単位、デフォルト値）
      // memoryThreshold: 50,          // メモリ警告閾値（MB単位、デフォルト値）
      // gcInterval: 1000,             // ガベージコレクション間隔（ms単位、デフォルト値）
      // largeActionThreshold: 100,    // 大きなアクションの閾値（KB単位、デフォルト値）

      // 特殊設定
      // selectivePaths: ['path.to.property'], // 選択的に保存するパス
      // immutable: false,             // イミュータブルデータモード

      // カスタムショートカット
      // keyboardShortcuts: {
      //   undo: ["z"],                // Undoのショートカットキー（Ctrl/Cmd + キー）
      //   redo: ["y", "Z"],           // Redoのショートカットキー（Ctrl/Cmd + キー）
      // },

      // コールバック関数
      // onStateChange: (newState) => {
      //   // 状態が変更されるたびに呼び出される
      //   console.log("状態が更新されました:", newState);

      //   // 例: 状態変更時に自動保存
      //   localStorage.setItem("auto-saved-state", JSON.stringify(newState));
      // },

      // onHistoryChange: (history) => {
      //   // 履歴が変更されるたびに呼び出される
      //   console.log(`履歴更新: ${history.length}アクション`);
      // },

      // onAction: (actionType, actionLabel) => {
      //   // アクション実行時に呼び出される（push/undo/redoの時）
      //   console.log(
      //     `アクション実行: ${actionType} - ${actionLabel || "unnamed"}`
      //   );

      //   // 例: 分析イベントの送信
      // },

      // 高度な拡張
      // plugins: [
      //   // カスタムプラグイン（独自拡張機能）
      //   // createHistoryPersistencePlugin(),
      //   // createDebugPlugin()
      // ],
    }
  );

  // キャンバスの描画処理
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // デバッグ情報を追加
    console.log("[Canvas] 描画更新:", {
      strokesLength: drawing.strokes?.length || 0,
      historyLength: history.length,
      canUndo,
      drawingState: drawing, // 完全な状態をログ出力
    });

    // キャンバスを必ずクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 描画なしの場合は早期リターン
    if (!drawing.strokes || drawing.strokes.length === 0) {
      console.log("[Canvas] 描画なし: キャンバスをクリア");
      return;
    }

    console.log("[Canvas] 描画するストローク数:", drawing.strokes.length);

    // 保存されたストロークを描画
    drawing.strokes.forEach((stroke, index) => {
      if (!stroke || stroke.points.length < 2) {
        console.log(`[Canvas] スキップ: ストローク ${index} は無効`, stroke);
        return;
      }

      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }

      ctx.stroke();
    });

    // 現在描画中のストロークを描画
    if (currentStroke.length > 1) {
      ctx.strokeStyle = drawing.currentColor;
      ctx.lineWidth = drawing.currentWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);

      for (let i = 1; i < currentStroke.length; i++) {
        ctx.lineTo(currentStroke[i].x, currentStroke[i].y);
      }

      ctx.stroke();
    }
  };

  // キャンバスのリサイズ処理
  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parentRect = canvas.parentElement?.getBoundingClientRect();
    if (!parentRect) return;

    canvas.width = parentRect.width;
    canvas.height = parentRect.height;

    renderCanvas();
  };

  // キャンバスの初期化とリサイズ設定
  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  // 描画状態が変更されたら再描画
  useEffect(() => {
    renderCanvas();
  }, [drawing, currentStroke]);

  // マウス/タッチイベントからの座標取得 - 修正版
  const getCoordinates = (
    e: React.MouseEvent | React.TouchEvent | TouchEvent | MouseEvent
  ): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width; // キャンバス内部サイズとDOM表示サイズの比率を計算
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      // タッチイベントの場合
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    } else {
      // マウスイベントの場合
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  // 描画開始処理
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    const point = getCoordinates(e);
    setIsDrawing(true);
    setCurrentStroke([point]);
  };

  // 描画中の処理
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    if (e.cancelable) e.preventDefault();

    const point = getCoordinates(e);
    setCurrentStroke((prev) => [...prev, point]);
  };

  // 描画終了の処理
  const endDrawing = () => {
    if (!isDrawing) return;

    // 新しいストロークを追加
    if (currentStroke.length > 1) {
      const newStroke: Stroke = {
        points: [...currentStroke],
        color: drawing.currentColor,
        width: drawing.currentWidth,
      };

      // batch処理で一つのアクションとして記録
      batch(() => {
        setDrawing((prev) => ({
          ...prev,
          // 新しい配列インスタンスを明示的に作成
          strokes: [...(prev.strokes || []), newStroke],
        }));
      }, `線を追加 (${drawing.currentColor.substring(1)}, ${drawing.currentWidth}px)`);
    }

    setIsDrawing(false);
    setCurrentStroke([]);
  };

  // 色の変更 - ここではあえて履歴に残すよう設定
  const changeColor = (color: string) => {
    setDrawing(
      (prev) => ({
        ...prev,
        currentColor: color,
      }),
      { label: `色を変更 (${color})` }
    );
  };

  // // [setState関数とオプション]
  // 基本的な使い方
  // setState(newState);

  // // 関数形式
  // setState(prev => ({ ...prev, count: prev.count + 1 }));

  // // ラベル付きの更新（履歴に表示されるラベル）
  // setState(newState, { label: "値を更新" });

  // // サイレントモード（履歴に残さない更新）
  // setState(newState, { silent: true });

  // // ラベル付きのサイレントモード
  // setState(newState, { label: "値を更新", silent: true });

  // // 複数の操作をまとめて一つのアンドゥステップにする
  // batch(() => {
  //   // この中での複数のsetStateは一つのアンドゥステップとしてまとめられる
  //   setState({ ...state, title: "新しいタイトル" });
  //   setState({ ...state, description: "新しい説明" });
  // }, "タイトルと説明を更新");

  // // [バッチ処理の使い方]
  // アクション配列を直接渡すことも可能（高度な使用法）
  // const actions = [
  //   createAction(
  //     () => { /* do something */ },
  //     () => { /* undo something */ },
  //     "アクション1"
  //   ),
  //   createAction(
  //     () => { /* do something else */ },
  //     () => { /* undo something else */ },
  //     "アクション2"
  //   )
  // ];
  // batch(actions, "複合アクション");

  // // [高度な履歴操作]
  // // 特定のインデックスまで戻る（履歴配列のインデックス）
  // undoTo(2);

  // // 特定のラベルがつけられた操作まで戻る
  // undoUntil("初期状態");

  // // 履歴を完全にクリア
  // clear();

  // // 履歴を維持したまま初期状態を変更
  // rebuild(newInitialState);

  // // [メモリ使用量の取得]
  // const memoryInfo = getMemoryUsage();
  // console.log(`合計アクション数: ${memoryInfo.actionCount}`);
  // console.log(`推定メモリ使用量: ${memoryInfo.estimatedBytes / 1024 / 1024} MB`);
  // console.log(`過去の操作数: ${memoryInfo.pastSize}`);
  // console.log(`将来の操作数: ${memoryInfo.futureSize}`);
  // console.log(`平均アクションサイズ: ${memoryInfo.averageActionSize / 1024} KB`);

  // // 最大のアクションについての情報
  // if (memoryInfo.largestAction) {
  //   console.log(`最大のアクション: ${memoryInfo.largestAction.label}`);
  //   console.log(`サイズ: ${memoryInfo.largestAction.size / 1024} KB`);
  // }

  // 線の太さを変更 - 履歴に残さないよう設定
  const changeWidth = (width: number) => {
    setDrawing(
      (prev) => ({
        ...prev,
        currentWidth: width,
      }),
      { silent: true }
    ); // silent: true で履歴に残さない
  };

  // キャンバスをクリア
  const clearCanvas = () => {
    batch(() => {
      setDrawing((prev) => ({
        ...prev,
        strokes: [],
      }));
    }, "キャンバスをクリア");
  };

  // 状態の保存と復元機能
  const saveCurrentState = () => {
    const serialized = JSON.stringify(drawing);
    localStorage.setItem("saved-drawing", serialized);
    alert("現在の描画状態を保存しました");
  };

  const loadSavedState = () => {
    const savedData = localStorage.getItem("saved-drawing");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setDrawing(parsed);
        alert("保存済みの描画を読み込みました");
      } catch (e) {
        alert("描画の読み込みに失敗しました");
      }
    } else {
      alert("保存された描画がありません");
    }
  };

  // メモリ使用量を取得
  const memoryUsage = getMemoryUsage();

  return (
    <div className="flex flex-col p-10">
      {/* 説明セクション */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h2 className="text-lg font-semibold mb-2">useUndoフックについて</h2>
        <p className="text-sm mb-2">
          このデモでは、状態の変更履歴を管理し、元に戻す/やり直しができるuseUndoフックの機能を紹介しています。
        </p>
        <ul className="text-sm list-disc ml-5">
          <li>線を描くと履歴に追加されます</li>
          <li>
            Undo/Redoボタンまたは
            <kbd className="px-1 py-0.5 bg-gray-200 rounded">Ctrl+Z</kbd>/
            <kbd className="px-1 py-0.5 bg-gray-200 rounded">Ctrl+Y</kbd>
            で操作を元に戻せます
          </li>
          <li>色や太さの変更は履歴に残りません（silent モードを使用）</li>
          <li>履歴パネルで操作の流れを確認できます</li>
        </ul>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">お絵描きデモ - useUndoフック</h1>

        <div className="flex space-x-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className={`px-3 py-2 rounded ${
              canUndo ? "bg-blue-500 text-white" : "bg-gray-300 text-gray-500"
            }`}
          >
            Undo
          </button>

          <button
            onClick={redo}
            disabled={!canRedo}
            className={`px-3 py-2 rounded ${
              canRedo ? "bg-blue-500 text-white" : "bg-gray-300 text-gray-500"
            }`}
          >
            Redo
          </button>

          <button
            onClick={clearCanvas}
            className="px-3 py-2 bg-red-500 text-white rounded"
          >
            クリア
          </button>
        </div>
      </div>

      {/* キャンバスエリアに固定の高さを設定 */}
      <div
        className="flex-grow relative border border-gray-300 rounded-lg overflow-hidden"
        style={{ minHeight: "200px", flex: "1 0 auto" }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
          className="absolute top-0 left-0 w-full h-full touch-none"
        />
      </div>

      {/* 線の設定セクション */}
      <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-200">
        <h3 className="text-sm font-medium mb-2">線の設定:</h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex space-x-2 items-center">
            <label className="text-sm font-medium">色:</label>
            {[
              "#000000",
              "#FF0000",
              "#00FF00",
              "#0000FF",
              "#FFFF00",
              "#FF00FF",
              "#00FFFF",
            ].map((color) => (
              <div
                key={color}
                onClick={() => changeColor(color)}
                className={`w-8 h-8 rounded-full cursor-pointer border ${
                  drawing.currentColor === color
                    ? "border-2 border-gray-800"
                    : "border-gray-300"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
            <input
              type="color"
              value={drawing.currentColor}
              onChange={(e) => changeColor(e.target.value)}
              className="w-8 h-8 cursor-pointer"
            />
          </div>

          <div className="flex space-x-2 items-center ml-4">
            <label className="text-sm font-medium">太さ:</label>
            <input
              type="range"
              min="1"
              max="20"
              value={drawing.currentWidth}
              onChange={(e) => changeWidth(Number(e.target.value))}
              className="w-32"
            />
            <span>{drawing.currentWidth}px</span>
          </div>
        </div>
      </div>

      {/* 高度な履歴操作セクション */}
      <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-200">
        <h3 className="text-sm font-medium mb-2">高度な操作:</h3>
        <div className="flex flex-wrap gap-2">
          {/* 状態の保存と復元 */}
          <div className="flex gap-2">
            <button
              onClick={saveCurrentState}
              className="px-3 py-1 bg-green-500 text-white text-sm rounded"
            >
              保存
            </button>
            <button
              onClick={loadSavedState}
              className="px-3 py-1 bg-amber-500 text-white text-sm rounded"
            >
              読み込み
            </button>
          </div>

          {/* 高度なUndo操作 */}
          <button
            onClick={() => {
              // 2つ前の操作に戻る
              if (history.length >= 3) {
                // 現在の操作から2つ前の操作をラベル名とインデックスで検索
                const targetIndex = history.findIndex(
                  (item) =>
                    item.label === history[history.length - 3]?.label &&
                    item.index === history[history.length - 3]?.index
                );

                if (targetIndex >= 0) {
                  undoTo(targetIndex);
                } else {
                  // 対象が見つからない場合は安全に一番最初まで戻る
                  undoTo(0);
                }
              }
            }}
            disabled={
              history.filter(
                (h) => !h.label.includes("silent") && h.label !== "初期状態"
              ).length < 2
            }
            className="px-2 py-1 bg-indigo-500 text-white text-xs rounded disabled:bg-gray-300"
          >
            2つ前の表示状態に戻る
          </button>
          <button
            onClick={() => undoUntil("初期状態")}
            disabled={!history.some((h) => h.label === "初期状態")}
            className="px-2 py-1 bg-purple-500 text-white text-xs rounded disabled:bg-gray-300"
          >
            初期状態まで戻る
          </button>
        </div>
      </div>

      {/* 履歴エリアを固定高さでスクロール可能に */}
      <div className="mt-4 border-t pt-2" style={{ flex: "0 0 auto" }}>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-medium">
            履歴 ({history.length} アクション):
          </h3>
          <button
            onClick={clear}
            className="px-3 py-1 bg-gray-500 text-white text-xs rounded"
          >
            履歴削除
          </button>
        </div>

        {/* スクロール可能な履歴エリア */}
        <div className="overflow-y-auto max-h-[150px] pr-2">
          <div className="flex flex-col gap-2">
            {history.map((item, index) => (
              <div
                key={index}
                className="px-2 py-1 text-xs rounded bg-gray-100 border border-gray-300"
              >
                {item.label || `ステップ ${index + 1}`}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* パフォーマンスと詳細情報 */}
      <div className="mt-4 border-t pt-2">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-xs text-blue-600 underline"
        >
          {showDetails ? "詳細を隠す" : "詳細を表示"}
        </button>

        {showDetails && (
          <div className="mt-2 text-xs bg-gray-50 p-2 rounded">
            <p>アクション数: {memoryUsage.actionCount}</p>
            <p>
              推定サイズ: {(memoryUsage.estimatedBytes / 1024).toFixed(2)} KB
            </p>
            <p>
              平均アクションサイズ:{" "}
              {(memoryUsage.averageActionSize / 1024).toFixed(2)} KB
            </p>
            {memoryUsage.largestAction && (
              <p>
                最大のアクション: {memoryUsage.largestAction.label || "なし"} (
                {(memoryUsage.largestAction.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>
        )}
      </div>

      {/* フッター：簡易ヘルプ */}
      <div className="mt-4 pt-2 pb-16 text-xs text-gray-500">
        <p>ヒント: Ctrl+Z でUndo、Ctrl+Y でRedoが可能です。</p>
      </div>
    </div>
  );
};

export default DrawingPage;
