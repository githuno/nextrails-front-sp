import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

export const runtime = "edge";
export const preferredRegion = "hnd1";
export const dynamic = "force-dynamic";

const RADIKO_BASE_URL = "https://radiko.jp";

// デフォルトヘッダーの型定義
interface RadikoHeaders {
  "User-Agent": string;
  Accept: string;
  "Accept-Language": string;
  "Accept-Encoding": string;
  Connection: string;
  "Cache-Control": string;
  Pragma: string;
  [key: string]: string;
}

// デフォルトヘッダー
const DEFAULT_HEADERS: RadikoHeaders = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "*/*",
  "Accept-Language": "ja",
  "Accept-Encoding": "gzip, deflate",
  "Connection": "keep-alive",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
};

// 認証ヘッダーの生成関数
function createAuthHeaders(
  customHeaders: Record<string, string>,
  clientIP: string
): RadikoHeaders {
  const authHeaders: RadikoHeaders = {
    ...DEFAULT_HEADERS,
    ...customHeaders,
    "X-Radiko-App": customHeaders["X-Radiko-App"] || "pc_html5",
    "X-Radiko-App-Version": customHeaders["X-Radiko-App-Version"] || "0.0.1",
    "X-Radiko-User": customHeaders["X-Radiko-User"] || "dummy_user",
    "X-Radiko-Device": customHeaders["X-Radiko-Device"] || "pc",
    "Origin": "https://radiko.jp",
    "Referer": "https://radiko.jp/",
    "X-Forwarded-For": clientIP,
    "X-Real-IP": clientIP,
  };

  // クライアントの現在時刻をJSTとして設定
  const jstDate = new Date(Date.now() + ((new Date().getTimezoneOffset() + 540) * 60 * 1000));
  authHeaders["Date"] = jstDate.toUTCString();
  
  return authHeaders;
}

// 認証フロー処理
async function handleRadikoAuth(
  customHeaders: Record<string, string>,
  clientIP: string
): Promise<Response> {
  const isAuth1 = !customHeaders["X-Radiko-AuthToken"];
  
  try {
    const requestHeaders = createAuthHeaders(customHeaders, clientIP);
    const url = `${RADIKO_BASE_URL}/v2/api/${isAuth1 ? "auth1" : "auth2"}`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: requestHeaders,
    });

    if (!response.ok) {
      console.error("Radiko auth error:", {
        type: isAuth1 ? "auth1" : "auth2",
        status: response.status,
        headers: requestHeaders,
      });
      return response;
    }

    const responseHeaders = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Cache-Control": "no-store",
    });

    // 必要なヘッダーのみを転送
    [
      "x-radiko-authtoken",
      "x-radiko-keyoffset",
      "x-radiko-keylength",
      "x-radiko-location",
      "x-radiko-areaid",
    ].forEach(header => {
      const value = response.headers.get(header);
      if (value) responseHeaders.set(header, value);
    });

    return new Response(null, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Radiko auth error:", error);
    return new Response(null, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const headersList = headers();
    const clientIP = headersList.get("x-client-ip");

    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get("path");
    const customHeaders = JSON.parse(searchParams.get("headers") || "{}");

    if (!path) {
      return NextResponse.json(
        { error: "Path parameter is required" },
        { status: 400 }
      );
    }

    if (!clientIP) {
      return NextResponse.json(
        { error: "Client IP is required" },
        { status: 400 }
      );
    }

    // 認証リクエストの処理
    if (path.includes("api/auth")) {
      return handleRadikoAuth(customHeaders, clientIP);
    }

    // 通常のリクエスト処理
    const url = path.startsWith("http") ? path : `${RADIKO_BASE_URL}/${path}`;
    const requestHeaders = createAuthHeaders(customHeaders, clientIP);

    const response = await fetch(url, {
      method: "GET",
      headers: requestHeaders,
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Radiko API Error:", {
        url,
        status: response.status,
        headers: requestHeaders,
      });
      return NextResponse.json(
        {
          error: `Radiko API error: ${response.status}`,
          details: { url, status: response.status },
        },
        { status: response.status }
      );
    }

    const data = await response.arrayBuffer();
    const responseHeaders = new Headers({
      "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Cache-Control": "no-store",
    });

    // 必要なヘッダーのみを転送
    [
      "x-radiko-authtoken",
      "x-radiko-keyoffset",
      "x-radiko-keylength",
      "x-radiko-location",
      "x-radiko-areaid",
    ].forEach(header => {
      const value = response.headers.get(header);
      if (value) responseHeaders.set(header, value);
    });

    return new NextResponse(data, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Radiko proxy error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    },
  });
}
