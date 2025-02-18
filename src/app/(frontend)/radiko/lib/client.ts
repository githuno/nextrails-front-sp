const PROXY_URL = "/api/proxy/radiko";
const AUTH_TOKEN_KEY = "radiko_auth_token";
const AREA_ID_KEY = "radiko_area_id";

// JST日付操作のためのヘルパー関数を修正
const getJSTDate = (date: Date = new Date()): Date => {
  const jstDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  return jstDate;
};

const formatJSTDate = (date: Date): string => {
  const jstDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  return (
    jstDate.getFullYear().toString() +
    String(jstDate.getMonth() + 1).padStart(2, "0") +
    String(jstDate.getDate()).padStart(2, "0")
  );
};

// JST日付操作のためのヘルパー関数を追加
const getJSTTime = (date: Date = new Date()): string => {
  const jstDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  return (
    jstDate.getFullYear().toString() +
    String(jstDate.getMonth() + 1).padStart(2, "0") +
    String(jstDate.getDate()).padStart(2, "0") +
    String(jstDate.getHours()).padStart(2, "0") +
    String(jstDate.getMinutes()).padStart(2, "0") +
    "00"
  );
};

// ヘッダーの型定義を修正
type RadikoHeaders = Record<string, string> & {
  "X-Radiko-App": string;
  "X-Radiko-App-Version": string;
  "X-Radiko-User": string;
  "X-Radiko-Device": string;
  "X-Radiko-AuthToken"?: string;
  "X-Radiko-Partialkey"?: string;
};

export class RadikoClient {
  private authToken: string = "";
  private areaId: string = "";

  constructor() {
    // ローカルストレージから認証情報を復元
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      const storedAreaId = localStorage.getItem(AREA_ID_KEY);
      if (storedToken) this.authToken = storedToken;
      if (storedAreaId) this.areaId = storedAreaId;
    }
  }

  private getDefaultHeaders(): RadikoHeaders {
    return {
      "X-Radiko-App": "pc_html5",
      "X-Radiko-App-Version": "0.0.1",
      "X-Radiko-User": "dummy_user",
      "X-Radiko-Device": "pc",
    };
  }

  private async proxyFetch(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = new URL(PROXY_URL, window.location.origin);
    url.searchParams.set("path", path);

    // ヘッダーの処理を修正
    const headers = {
      ...this.getDefaultHeaders(),
      ...((options.headers as Partial<RadikoHeaders>) || {}),
    } as RadikoHeaders;

    if (this.authToken) {
      headers["X-Radiko-AuthToken"] = this.authToken;
    }

    url.searchParams.set("headers", JSON.stringify(headers));

    try {
      const response = await fetch(url.toString(), {
        ...options,
        headers: undefined,
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401) {
          // 認証エラーの場合は保存された認証情報をクリア
          this.clearAuth();
          // 再認証を試みる
          await this.authenticate();
          // リクエストを再試行
          return this.proxyFetch(path, options);
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          throw new Error(JSON.stringify(error));
        } else {
          const error = await response.text();
          throw new Error(`Proxy request failed: ${error}`);
        }
      }

      return response;
    } catch (error) {
      console.error("Proxy fetch error:", error);
      if (error instanceof Error && error.message.includes("Failed to fetch")) {
        // ネットワークエラーの場合は少し待ってから再試行
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.proxyFetch(path, options);
      }
      throw error;
    }
  }

  private async authenticate(): Promise<void> {
    try {
      // Auth1: 認証トークンと鍵情報の取得
      const auth1Response = await this.proxyFetch("v2/api/auth1");

      const authToken = auth1Response.headers.get("x-radiko-authtoken");
      const keyOffset = auth1Response.headers.get("x-radiko-keyoffset");
      const keyLength = auth1Response.headers.get("x-radiko-keylength");

      if (!authToken || !keyOffset || !keyLength) {
        throw new Error("Auth1: Missing required headers");
      }

      // パーシャルキーの生成
      const AUTH_KEY = "bcd151073c03b352e1ef2fd66c32209da9ca0afa";
      const offset = parseInt(keyOffset, 10);
      const length = parseInt(keyLength, 10);
      const partialKey = btoa(AUTH_KEY.substring(offset, offset + length));

      // Auth2: パーシャルキーでの認証
      this.authToken = authToken;
      await this.proxyFetch("v2/api/auth2", {
        headers: {
          "X-Radiko-Partialkey": partialKey,
        } as RadikoHeaders,
      });

      // 認証成功時にローカルストレージに保存
      if (typeof window !== "undefined") {
        localStorage.setItem(AUTH_TOKEN_KEY, this.authToken);
      }
    } catch (error) {
      this.clearAuth();
      throw error;
    }
  }

  private clearAuth(): void {
    this.authToken = "";
    this.areaId = "";
    if (typeof window !== "undefined") {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AREA_ID_KEY);
    }
  }

  async init(): Promise<void> {
    try {
      if (!this.authToken) {
        await this.authenticate();
      }
      if (!this.areaId) {
        this.areaId = await this.getAreaId();
        if (typeof window !== "undefined") {
          localStorage.setItem(AREA_ID_KEY, this.areaId);
        }
      }
    } catch (error) {
      console.error("Initialization failed:", error);
      this.clearAuth();
      throw error;
    }
  }

  private async getAreaId(): Promise<string> {
    try {
      const response = await this.proxyFetch("v2/area");
      const text = await response.text();
      const match = text.match(/"(.*?)"/);
      const areaId = match ? match[1] : "";

      // OUT（国外）や空の場合は東京のエリアIDを使用
      if (!areaId || areaId === "OUT") {
        return "JP13"; // 東京
      }
      return areaId;
    } catch (error) {
      console.warn("Error getting area ID, defaulting to Tokyo:", error);
      return "JP13"; // エラー時も東京をデフォルトとする
    }
  }

  // 認証トークンを取得するメソッドを追加
  getAuthToken(): string {
    return this.authToken;
  }

  async getStations() {
    try {
      if (!this.areaId) await this.init();
      // エリアIDが不正な場合は東京に設定
      if (this.areaId === "OUT" || !this.areaId) {
        this.areaId = "JP13";
      }

      const response = await this.proxyFetch(
        `v3/station/list/${this.areaId}.xml`
      );
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/xml");

      return Array.from(doc.querySelectorAll("station")).map((station) => ({
        id: station.querySelector("id")?.textContent || "",
        name: station.querySelector("name")?.textContent || "",
        url: station.querySelector("href")?.textContent || "",
      }));
    } catch (error) {
      console.error("Failed to get stations:", error);
      // エラー時は空の配列を返す
      return [];
    }
  }

  async getPrograms(stationId: string, date: Date) {
    try {
      if (!this.authToken) await this.init();

      // 日付文字列をJSTベースで生成
      const dateStr = formatJSTDate(date);

      const response = await this.proxyFetch(
        `v3/program/station/date/${dateStr}/${stationId}.xml`
      );

      const text = await response.text();
      if (!text || text.trim() === "") {
        throw new Error("Empty response from server");
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "text/xml");

      // XMLパースエラーのチェック
      const parseError = doc.querySelector("parsererror");
      if (parseError) {
        throw new Error("Failed to parse XML response");
      }

      return Array.from(doc.querySelectorAll("prog")).map((prog) => ({
        title: prog.querySelector("title")?.textContent || "",
        startTime: prog.getAttribute("ft") || "",
        endTime: prog.getAttribute("to") || "",
        url: prog.querySelector("url")?.textContent || "",
      }));
    } catch (error) {
      console.error("Failed to get programs:", error);
      // エラー発生時は空の配列を返す
      return [];
    }
  }

  async getStreamUrl(
    stationId: string,
    ft: string,
    to: string
  ): Promise<string> {
    try {
      if (!this.authToken) {
        await this.init();
      }

      // JST時刻文字列からDateオブジェクトを作成
      const createJSTDate = (timeStr: string): Date => {
        const year = parseInt(timeStr.substring(0, 4));
        const month = parseInt(timeStr.substring(4, 6)) - 1;
        const day = parseInt(timeStr.substring(6, 8));
        const hour = parseInt(timeStr.substring(8, 10));
        const minute = parseInt(timeStr.substring(10, 12));
        
        // JSTでの日時を指定
        const date = new Date();
        date.setFullYear(year);
        date.setMonth(month);
        date.setDate(day);
        date.setHours(hour);
        date.setMinutes(minute);
        date.setSeconds(0);
        
        // UTCに変換
        return new Date(date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
      };

      const queryParams = new URLSearchParams({
        station_id: stationId,
        ft: getJSTTime(createJSTDate(ft)),
        to: getJSTTime(createJSTDate(to)),
        l: "15",
      });

      const response = await this.proxyFetch(
        `v2/api/ts/playlist.m3u8?${queryParams}`,
        {
          headers: {
            "X-Radiko-AuthToken": this.authToken,
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          // 認証エラーの場合、認証をクリアして再認証
          this.clearAuth();
          await this.init();
          // 再帰的に再試行
          return this.getStreamUrl(stationId, ft, to);
        }
        throw new Error(`Failed to get playlist: ${response.status}`);
      }

      const m3u8Text = await response.text();
      const masterPlaylistUrl = m3u8Text
        .split("\n")
        .find((line) => line.trim() && !line.startsWith("#"));

      if (!masterPlaylistUrl) {
        throw new Error("No playlist URL found");
      }

      const proxyUrl = new URL(PROXY_URL, window.location.origin);
      proxyUrl.searchParams.set("path", masterPlaylistUrl);
      proxyUrl.searchParams.set(
        "headers",
        JSON.stringify({
          ...this.getDefaultHeaders(),
          "X-Radiko-AuthToken": this.authToken,
        })
      );

      return proxyUrl.toString();
    } catch (error) {
      console.error("Stream URL error:", error);
      if (
        error instanceof Error &&
        (error.message.includes("401") || error.message.includes("auth"))
      ) {
        // 認証関連のエラーの場合、認証をクリアして再認証
        this.clearAuth();
        await this.init();
        // 再帰的に再試行（最大1回）
        return this.getStreamUrl(stationId, ft, to);
      }
      throw error;
    }
  }
}
