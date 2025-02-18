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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get("path");
  const headers = JSON.parse(searchParams.get("headers") || "{}");

  if (!path) {
    return new NextResponse("Path parameter is required", { status: 400 });
  }

  try {
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

    // Radikoの認証ヘッダーを設定
    const requestHeaders: CustomHeadersInit = {
      ...RADIKO_HEADERS,
      ...headers,
      // 日本の固定IPアドレスを設定（東京のIPアドレス範囲の例）
      "X-Forwarded-For": "133.203.1.1",
      // User-Agentを固定（一般的なブラウザとして認識されるように）
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      // Accept-Encodingを指定して圧縮形式を制御
      "Accept-Encoding": "gzip, deflate",
      // Origin と Referer を追加
      "Origin": "https://radiko.jp",
      "Referer": "https://radiko.jp/"
    };

    const response = await fetch(url, {
      headers: requestHeaders,
      method: "GET",
      redirect: "follow",
    });

    // エラーハンドリング
    if (!response.ok) {
      console.error("Radiko API Error:", {
        url,
        status: response.status,
        statusText: response.statusText,
        path,
        headers: requestHeaders,
      });

      if (response.status === 404) {
        // エリア情報の取得に失敗した場合、デフォルトの東京エリアを使用
        if (path.includes("station/list/OUT.xml")) {
          const tokyoResponse = await fetch(url.replace("OUT.xml", "JP13.xml"), {
            headers: requestHeaders,
            method: "GET",
            redirect: "follow",
          });
          
          if (tokyoResponse.ok) {
            const responseBody = await tokyoResponse.arrayBuffer();
            const responseHeaders = new Headers();
            // 必要なヘッダーのみを転送
            responseHeaders.set("Content-Type", tokyoResponse.headers.get("Content-Type") || "application/xml");
            responseHeaders.set("Access-Control-Allow-Origin", "*");
            // Content-Encodingヘッダーは削除（自動的に解凍される）
            return new NextResponse(responseBody, {
              status: 200,
              headers: responseHeaders,
            });
          }
        }

        return new NextResponse(
          JSON.stringify({
            error: "Resource not found",
            details: "The requested Radiko API endpoint returned 404",
            path: path,
          }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // レスポンスの処理
    const responseBody = await response.arrayBuffer();
    const responseHeaders = new Headers();
    
    // 必要なヘッダーのみを転送
    responseHeaders.set("Content-Type", response.headers.get("Content-Type") || "application/xml");
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "*");
    
    // Radikoの認証関連ヘッダーを転送
    ["X-Radiko-AuthToken", "X-Radiko-KeyOffset", "X-Radiko-KeyLength"].forEach(header => {
      const value = response.headers.get(header);
      if (value) responseHeaders.set(header, value);
    });

    return new NextResponse(responseBody, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const status = errorMessage.includes("404") ? 404 : 500;
    
    return new NextResponse(
      JSON.stringify({
        error: errorMessage,
        timestamp: new Date().toISOString(),
        timezone: "Asia/Tokyo"
      }),
      {
        status: status,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
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
