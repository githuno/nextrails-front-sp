import { NextRequest, NextResponse } from "next/server";

const V2_URL = "https://radiko.jp/v2/";
const V3_URL = "https://radiko.jp/v3/";
const AREA_URL = "https://radiko.jp/area";

type RadikoHeaders = {
  "User-Agent": string;
  "X-Radiko-App": string;
  "X-Radiko-App-Version": string;
  "X-Radiko-Device": string;
  "X-Radiko-User": string;
  "X-Radiko-AuthToken"?: string;
};

// Radikoの認証用ヘッダー
const RADIKO_HEADERS: RadikoHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
  "X-Radiko-App": "pc_html5",
  "X-Radiko-App-Version": "0.0.1",
  "X-Radiko-Device": "pc",
  "X-Radiko-User": "dummy_user",
};

// カスタムヘッダー型の定義
type CustomHeadersInit = HeadersInit & {
  [key: string]: string;
};

// JSTタイムゾーンのヘルパー関数を修正
function getJSTDate(date: Date = new Date()): Date {
  return new Date(date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
}

function formatToJST(timeStr: string): string {
  if (!timeStr) return "";

  try {
    const date = new Date(timeStr);
    return date.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).replace(/[/:\s]/g, "");
  } catch (error) {
    console.error("Date formatting error:", error);
    return timeStr;
  }
}

// 日本のIPアドレスプール（これは例です）
const JAPAN_IP_POOL = [
  "133.203.1.1",
  "133.203.1.2",
  "133.203.1.3",
  // 必要に応じて追加
];

// ランダムな日本のIPアドレスを取得
function getRandomJapanIP() {
  return JAPAN_IP_POOL[Math.floor(Math.random() * JAPAN_IP_POOL.length)];
}

// 有効な日本のIPアドレス範囲（JPNIC割り当て）
const JAPAN_IP_RANGES = [
  ['133.200.0.0', '133.203.255.255'],  // JPNIC
  ['133.205.0.0', '133.208.255.255'],  // JPNIC
  ['133.209.0.0', '133.211.255.255'],  // JPNIC
  // 必要に応じて追加
];

// IPアドレスを数値に変換
function ipToLong(ip: string): number {
  return ip.split('.')
    .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

// IPアドレスが日本のIP範囲内かチェック
function isJapaneseIPRange(ip: string): boolean {
  const ipLong = ipToLong(ip);
  return JAPAN_IP_RANGES.some(([start, end]) => {
    const startLong = ipToLong(start);
    const endLong = ipToLong(end);
    return ipLong >= startLong && ipLong <= endLong;
  });
}

// クライアントIPを取得する関数
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const cfConnectingIP = request.headers.get("cf-connecting-ip");  // Cloudflare
  const vercelIP = request.headers.get("x-vercel-forwarded-for");  // Vercel specific

  // 優先順位に従ってIPを取得
  const clientIP = vercelIP || cfConnectingIP || forwarded?.split(",")[0].trim() || realIP;

  // 有効なIPアドレスが取得できない場合はJPNICの範囲内のIPを使用
  if (!clientIP || !isJapaneseIPRange(clientIP)) {
    return "133.200.1.1";  // JPNICの範囲内の固定IP
  }

  return clientIP;
}

// IPの検証を強化
async function validateIP(ip: string): Promise<boolean> {
  // まずJPNICの範囲でチェック
  if (isJapaneseIPRange(ip)) {
    return true;
  }

  // JPNIC範囲外の場合は外部APIで二重チェック
  try {
    const [geoResponse1, geoResponse2] = await Promise.all([
      fetch(`http://ip-api.com/json/${ip}?fields=countryCode`),
      fetch(`https://ipapi.co/${ip}/country`)
    ]);

    const data1 = await geoResponse1.json();
    const country2 = await geoResponse2.text();

    // 両方のAPIが日本と判定した場合のみtrue
    return data1.countryCode === "JP" && country2.trim() === "JP";
  } catch (error) {
    console.error("IP validation error:", error);
    // エラーの場合はJPNICの範囲チェック結果を信頼
    return isJapaneseIPRange(ip);
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get("path");
  const headers = JSON.parse(searchParams.get("headers") || "{}");

  if (!path) {
    return new NextResponse("Path parameter is required", { status: 400 });
  }

  try {
    const clientIP = getClientIP(request);
    
    // 本番環境でのIP検証を強化
    if (process.env.NODE_ENV === "production") {
      const isValidIP = await validateIP(clientIP);
      if (!isValidIP) {
        return new NextResponse(
          JSON.stringify({
            error: "Access denied: Invalid IP address",
            timestamp: new Date().toISOString(),
            timezone: "Asia/Tokyo",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    let url;
    if (path === "v2/area") {
      url = AREA_URL;
    } else if (path.startsWith("http")) {
      url = path;
    } else {
      const baseUrl = path.startsWith("v2/") ? V2_URL : V3_URL;
      const cleanPath = path.replace(/^v[23]\//, "");
      url = new URL(cleanPath, baseUrl).toString();
    }

    // Radikoの認証ヘッダーを設定（改善版）
    const requestHeaders: CustomHeadersInit = {
      ...RADIKO_HEADERS,
      ...headers,
      // クライアントIPを設定
      "X-Forwarded-For": clientIP,
      "X-Real-IP": clientIP,
      "X-Client-IP": clientIP,  // 追加
      "X-Originating-IP": clientIP,  // 追加
      // Accept-Encodingを指定して圧縮形式を制御
      "Accept-Encoding": "gzip, deflate",
      // Origin と Referer を追加
      "Origin": "https://radiko.jp",
      "Referer": "https://radiko.jp/",
      // タイムゾーンヘッダーを追加（JST固定）
      "Date": new Date().toUTCString(),
      "Time-Zone": "Asia/Tokyo",
      // 追加のヘッダー
      "X-Requested-With": "XMLHttpRequest",
      "Connection": "keep-alive",
    };

    // リトライロジックを実装
    let retryCount = 0;
    const maxRetries = 3;
    let response: Response;

    while (retryCount < maxRetries) {
      response = await fetch(url, {
        headers: requestHeaders,
        method: "GET",
        redirect: "follow",
      });

      if (response.ok) {
        break;
      }

      if (response.status === 401) {
        // 認証エラーの場合、異なるIPアドレスで再試行
        requestHeaders["X-Forwarded-For"] = getRandomJapanIP();
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        continue;
      }

      break;
    }

    // エラーハンドリング（最後の応答を使用）
    if (!response!.ok) {
      console.error("Radiko API Error:", {
        url,
        status: response!.status,
        statusText: response!.statusText,
        path,
        headers: requestHeaders,
      });

      // エラーレスポンスの処理
      const errorResponse = {
        error: `HTTP error! status: ${response!.status}`,
        url: url,
        path: path,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Tokyo",
        headers: {
          ...requestHeaders,
          // センシティブな情報を削除
          "X-Forwarded-For": "***.***.***.*****",
        },
        responseStatus: response!.status,
        responseStatusText: response!.statusText,
      };

      return new NextResponse(JSON.stringify(errorResponse), {
        status: response!.status,
        headers: {
          "Content-Type": "application/json",
          ...(response!.status === 401 && { "WWW-Authenticate": "Bearer" }),
        },
      });
    }

    // レスポンスの処理
    const responseBody = await response!.arrayBuffer();
    const responseHeaders = new Headers();
    
    // 必要なヘッダーのみを転送
    responseHeaders.set("Content-Type", response!.headers.get("Content-Type") || "application/octet-stream");
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "*");
    
    // Radikoの認証関連ヘッダーを転送
    ["X-Radiko-AuthToken", "X-Radiko-KeyOffset", "X-Radiko-KeyLength"].forEach(header => {
      const value = response!.headers.get(header);
      if (value) responseHeaders.set(header, value);
    });

    return new NextResponse(responseBody, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const status = errorMessage.includes("404") ? 404 : 500;

    const errorResponse = {
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
      timezone: "Asia/Tokyo",
      path: path,
      details: error instanceof Error ? error.stack : undefined,
    };

    return new NextResponse(JSON.stringify(errorResponse), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        Date: new Date().toUTCString(),
        "Time-Zone": "Asia/Tokyo",
      },
    });
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Expose-Headers":
        "X-Radiko-Authtoken, X-Radiko-KeyOffset, X-Radiko-KeyLength",
    },
  });
}
