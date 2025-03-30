// ジョブベースのWeb Worker共通テンプレート - 時間のかかるバージョン

// ジョブ処理中フラグ
let isProcessing = false;

// 利用可能な計算関数マップ
const calculators = {
  fibonacci: (n, options = {}) => {
    if (n <= 0) return 0;
    if (n === 1) return 1;

    // 進捗報告（開始）
    reportProgress(0);

    let a = 0,
      b = 1;
    const totalSteps = n - 1;
    const delayMs = options.slowMode ? 100 : 0; // スローモード時は各ステップで100ms遅延

    return new Promise(async (resolve) => {
      // 非同期ループでフィボナッチ計算（意図的に遅延を入れる）
      for (let i = 2; i <= n; i++) {
        // 進捗報告
        const percent = Math.floor(((i - 2) / totalSteps) * 100);
        reportProgress(percent);

        // 意図的な遅延
        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }

        const temp = a + b;
        a = b;
        b = temp;
      }

      // 完了報告
      reportProgress(100);
      resolve(b);
    });
  },

  factorial: (n, options = {}) => {
    if (n < 0) throw new Error("負の数の階乗は定義されていません");
    if (n > 170) throw new Error("数値が大きすぎます");

    // 進捗報告（開始）
    reportProgress(0);

    const delayMs = options.slowMode ? 150 : 0; // スローモード時は各ステップで150ms遅延
    const totalSteps = Math.max(1, n - 1);

    return new Promise(async (resolve) => {
      let result = 1;

      // 非同期ループで階乗計算（意図的に遅延を入れる）
      for (let i = 2; i <= n; i++) {
        // 進捗報告
        const percent = Math.floor(((i - 2) / totalSteps) * 100);
        reportProgress(percent);

        // 意図的な遅延
        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }

        result *= i;
      }

      // 完了報告
      reportProgress(100);
      resolve(result);
    });
  },

  prime: (num, options = {}) => {
    if (num <= 1) return false;
    if (num <= 3) return true;
    if (num % 2 === 0 || num % 3 === 0) return false;

    // 進捗報告（開始）
    reportProgress(0);

    const limit = Math.sqrt(num);
    const delayMs = options.slowMode ? 50 : 0; // スローモード時は各ステップで50ms遅延

    return new Promise(async (resolve) => {
      let i = 5;
      const totalSteps = Math.max(1, Math.floor((limit - 5) / 6) + 1);
      let step = 0;

      while (i <= limit) {
        // 進捗報告
        const percent = Math.min(99, Math.floor((step / totalSteps) * 100));
        reportProgress(percent);

        // 意図的な遅延
        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }

        if (num % i === 0 || num % (i + 2) === 0) {
          reportProgress(100);
          return resolve(false);
        }

        i += 6;
        step++;
      }

      // 完了報告
      reportProgress(100);
      resolve(true);
    });
  },

  // 純粋に進捗デモ用の重い処理（何も計算せずに時間だけかかる）
  delayDemo: (steps = 20, options = {}) => {
    const delay = options.delay || 300; // 各ステップの遅延時間（ミリ秒）

    return new Promise(async (resolve) => {
      // 進捗報告（開始）
      reportProgress(0);

      for (let i = 1; i <= steps; i++) {
        // 現在の進捗率を計算
        const percent = Math.floor((i / steps) * 100);

        // 進捗を報告
        reportProgress(percent);

        // 意図的に遅延
        await new Promise((r) => setTimeout(r, delay));
      }

      // 完了報告
      reportProgress(100);
      resolve(`${steps}ステップ完了（合計: ${delay * steps}ms）`);
    });
  },
};

// 現在のジョブID
let currentJobId = null;
let isDebugMode = false;

// Worker初期化メッセージ
console.log("[Worker] 初期化しました - " + new Date().toISOString());

// 一意のWorker ID（各インスタンスで異なる値になります）
const workerId = `worker-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
console.log(`[Worker ${workerId}] 初期化しました`);

// デバッグログ関数
function log(...args) {
  if (isDebugMode) {
    console.log("[GenericWorker]", ...args);
  }
}

// 進捗報告関数
function reportProgress(percent) {
  self.postMessage({
    type: "PROGRESS",
    payload: { percent },
    jobId: currentJobId,
  });
}

// ジョブ結果送信関数
function sendResult(result) {
  self.postMessage({
    type: "RESULT",
    payload: result,
    jobId: currentJobId,
  });
}

// エラー送信関数
function sendError(error) {
  self.postMessage({
    type: "ERROR",
    payload: { message: error.message },
    jobId: currentJobId,
  });
}

// メッセージイベントリスナー
self.addEventListener("message", async (event) => {
  const { type, payload, jobId, debug } = event.data || {};

  // デバッグモード設定
  isDebugMode = debug === true;

  log("Received message:", event.data);

  // ジョブメッセージを処理
  if (type === "JOB") {
    // 既存のジョブ処理中の場合はエラー
    if (isProcessing) {
      sendError(new Error("Worker is busy processing another job"));
      return;
    }

    // ジョブ処理開始
    isProcessing = true;
    currentJobId = jobId;

    try {
      const { type: calculationType, n, ...restParams } = payload;

      // 計算関数の選択
      const calculator = calculators[calculationType];
      if (!calculator) {
        throw new Error(`Unknown calculation type: ${calculationType}`);
      }

      log(`Starting calculation: ${calculationType}(${n})`);

      // 常にスローモードを有効化（進捗確認用）
      const options = {
        ...restParams,
        slowMode: true, // 意図的に遅延させる
      };

      // 実際の計算を実行（非同期関数の場合はawaitを使用）
      const result = await calculator(n, options);

      log(`Calculation complete: ${calculationType}(${n}) = ${result}`);

      // 結果を送信
      sendResult(result);
    } catch (error) {
      log("Calculation error:", error);
      sendError(error);
    } finally {
      // 処理状態をリセット
      isProcessing = false;
      currentJobId = null;
    }
  }

  // Worker ID取得リクエスト
  if (type === "GET_ID") {
    self.postMessage({
      type: "ID_RESPONSE",
      workerId: workerId,
    });
    return;
  }
  // PINGメッセージなど他のタイプも処理可能
  else if (type === "PING") {
    self.postMessage({
      type: "PONG",
      payload: { time: Date.now() },
      jobId,
    });
  }
});

// Workerの初期化完了メッセージ
log("GenericWorker initialized - Slow calculation mode");
