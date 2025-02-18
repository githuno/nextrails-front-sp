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
  const authToken = searchParams.get("authToken");
  const customHeaders = JSON.parse(searchParams.get("headers") || "{}");

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
      const urlObj = new URL(cleanPath, baseUrl);
      searchParams.forEach((value, key) => {
        if (!["path", "authToken", "headers"].includes(key)) {
          urlObj.searchParams.set(key, value);
        }
      });
      url = urlObj.toString();
    }

    const headers: CustomHeadersInit = {
      ...RADIKO_HEADERS,
      ...customHeaders,
    };

    if (authToken) {
      headers["X-Radiko-AuthToken"] = authToken;
    }

    // ストリーミング用のヘッダーを追加
    if (url.includes(".m3u8") || url.includes(".aac")) {
      headers["Origin"] = "https://radiko.jp";
      headers["Referer"] = "https://radiko.jp/";
    }

    // console.log("Making request to:", {
    //   url,
    //   headers: Object.fromEntries(Object.entries(headers)),
    // });

    const response = await fetch(url, {
      headers,
      method: "GET",
      redirect: "follow",
    });

    // エラーレスポンスの詳細をログ
    if (!response.ok) {
      console.error("Radiko API Error:", {
        url,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      });
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseHeaders = new Headers();

    // レスポンスヘッダーの設定を改善
    Array.from(response.headers.entries()).forEach(([key, value]) => {
      // 重要なヘッダーを保持
      if (
        key.toLowerCase().startsWith("x-radiko-") ||
        key.toLowerCase() === "content-type" ||
        key.toLowerCase() === "content-length"
      ) {
        responseHeaders.set(key, value);
      }
    });

    // CORSヘッダーの設定を改善
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "*");
    responseHeaders.set(
      "Access-Control-Expose-Headers",
      "x-radiko-authtoken, x-radiko-keyoffset, x-radiko-keylength, content-type, content-length"
    );

    // Content-Typeの設定を改善
    if (!responseHeaders.has("Content-Type")) {
      if (url.includes(".m3u8")) {
        responseHeaders.set("Content-Type", "application/vnd.apple.mpegurl");
      } else if (url.includes(".aac")) {
        responseHeaders.set("Content-Type", "audio/aac");
      }
    }

    // ストリーミング用のヘッダーを追加
    if (url.includes(".m3u8") || url.includes(".aac")) {
      responseHeaders.set("Accept-Ranges", "bytes");
      responseHeaders.set("Connection", "keep-alive");
      responseHeaders.set("Transfer-Encoding", "chunked");
    }

    // キャッシュ制御の追加
    responseHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
    responseHeaders.set("Pragma", "no-cache");
    responseHeaders.set("Expires", "0");

    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return new NextResponse(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
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
