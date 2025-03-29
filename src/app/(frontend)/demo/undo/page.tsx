"use client";

import React, { useRef, useState, useEffect } from "react";
import useUndo from "@/hooks/useUndo";

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

  // Undoフックを使用して描画状態を管理
  const {
    state: drawing,
    setState: setDrawing,
    undo,
    redo,
    canUndo,
    canRedo,
    batch,
    history,
    clear,
    createAction,
    stack,
  } = useUndo<DrawingState>(
    {
      strokes: [],
      currentColor: "#000000",
      currentWidth: 3,
    },
    {
      debug: true,
      enableKeyboardShortcuts: true,
      compress: true,
    }
  );

  // キャンバスの描画処理
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // キャンバスをクリア
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 保存されたストロークを描画
    drawing.strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;

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

      // 現在の状態をスナップショット
      const currentStrokes = [...drawing.strokes];

      // 更新関数を定義
      setDrawing((prev) => {
        // 更新された状態を返す
        return {
          ...prev,
          strokes: [...prev.strokes, newStroke],
        };
      });

      // Undoスタックに明示的なアクションを追加
      // (setState内の暗黙的なアクションの代わりに)
      stack.push(
        // do関数: ストロークを追加
        () => ({
          ...drawing,
          strokes: [...currentStrokes, newStroke],
        }),
        // undo関数: ストロークを削除
        () => ({
          ...drawing,
          strokes: currentStrokes,
        }),
        `線を追加 (${drawing.currentColor.substring(1)}, ${
          drawing.currentWidth
        }px)`
      );
    }

    setIsDrawing(false);
    setCurrentStroke([]);
  };

  // 色の変更
  const changeColor = (color: string) => {
    setDrawing((prev) => ({
      ...prev,
      currentColor: color,
    }));
  };

  // 線の太さを変更
  const changeWidth = (width: number) => {
    setDrawing((prev) => ({
      ...prev,
      currentWidth: width,
    }));
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

  return (
    <div className="flex flex-col h-[80vh] p-10 pt-[200px]">
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
        style={{ minHeight: "400px", flex: "1 0 auto" }}
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
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
    </div>
  );
};

export default DrawingPage;
