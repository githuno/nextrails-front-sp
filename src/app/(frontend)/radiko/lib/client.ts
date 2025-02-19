const PROXY_URL = "/api/proxy/radiko";
const AUTH_KEY = "bcd151073c03b352e1ef2fd66c32209da9ca0afa";

const formatJSTDate = (date: Date): string => {
  const jstDate = new Date(
    date.toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
  );
  return (
    jstDate.getFullYear().toString() +
    String(jstDate.getMonth() + 1).padStart(2, "0") +
    String(jstDate.getDate()).padStart(2, "0")
  );
};

interface RadikoHeaders {
  "X-Radiko-App": string;
  "X-Radiko-App-Version": string;
  "X-Radiko-User": string;
  "X-Radiko-Device": string;
  "X-Radiko-AuthToken"?: string;
  "X-Radiko-Partialkey"?: string;
}

export class RadikoClient {
  private authToken: string = "";
  private areaId: string = "";
  private retryCount: number = 0;
  private readonly maxRetries: number = 3;

  private async authenticate(): Promise<void> {
    try {
      // Rustの実装を参考に、auth1とauth2を一連のトランザクションとして扱う
      const auth1Headers = {
        "X-Radiko-App": "pc_html5",
        "X-Radiko-App-Version": "0.0.1",
        "X-Radiko-User": "dummy_user",
        "X-Radiko-Device": "pc",
      };

      // auth1: 認証トークンと鍵情報の取得
      const auth1Response = await this.proxyFetch("v2/api/auth1", {
        headers: auth1Headers,
      });

      const authToken = auth1Response.headers.get("x-radiko-authtoken");
      const keyOffset = auth1Response.headers.get("x-radiko-keyoffset");
      const keyLength = auth1Response.headers.get("x-radiko-keylength");

      if (!authToken || !keyOffset || !keyLength) {
        throw new Error("Authentication failed: Missing auth1 headers");
      }

      // パーシャルキーの生成（Rustの実装と同じロジック）
      const offset = parseInt(keyOffset);
      const length = parseInt(keyLength);
      const partialKey = btoa(AUTH_KEY.substring(offset, offset + length));

      // auth2: パーシャルキーを使用した認証
      // auth1で取得したトークンと生成したパーシャルキーを使用
      const auth2Headers = {
        ...auth1Headers,
        "X-Radiko-AuthToken": authToken,
        "X-Radiko-Partialkey": partialKey,
      };

      const auth2Response = await this.proxyFetch("v2/api/auth2", {
        headers: auth2Headers,
      });

      if (!auth2Response.ok) {
        this.authToken = "";
        throw new Error("Authentication failed at auth2");
      }

      // 認証成功時のみトークンを設定
      this.authToken = authToken;

      // エリア情報も取得（Rustの実装と同様）
      await this.fetchAreaId();
    } catch (error) {
      // エラー時は認証情報をクリア
      this.authToken = "";
      this.areaId = "";
      throw error;
    }
  }

  private async fetchAreaId(): Promise<void> {
    try {
      const response = await this.proxyFetch("v2/api/auth2");
      const areaId = response.headers.get("x-radiko-areaid");
      this.areaId = areaId || "JP13"; // デフォルトは東京
    } catch (error) {
      console.error("Failed to fetch area ID:", error);
      this.areaId = "JP13"; // エラー時は東京をデフォルトとする
    }
  }

  private getDefaultHeaders(): RadikoHeaders {
    const headers: RadikoHeaders = {
      "X-Radiko-App": "pc_html5",
      "X-Radiko-App-Version": "0.0.1",
      "X-Radiko-User": "dummy_user",
      "X-Radiko-Device": "pc",
    };

    if (this.authToken) {
      headers["X-Radiko-AuthToken"] = this.authToken;
    }

    return headers;
  }

  // リクエスト共通処理の改善
  private async proxyFetch(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = new URL(PROXY_URL, window.location.origin);
    url.searchParams.set("path", path);

    // Rustの実装を参考にヘッダーを設定
    const headers = {
      ...(options.headers || this.getDefaultHeaders()),
      Accept: "*/*",
      "Accept-Language": "ja",
      Connection: "keep-alive",
    };

    url.searchParams.set("headers", JSON.stringify(headers));

    try {
      const response = await fetch(url.toString(), {
        ...options,
        headers: undefined,
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 401 && this.retryCount < this.maxRetries) {
          this.retryCount++;
          this.authToken = "";
          await this.authenticate();
          return this.proxyFetch(path, options);
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      this.retryCount = 0;
      return response;
    } catch (error) {
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * this.retryCount)
        );
        return this.proxyFetch(path, options);
      }
      throw error;
    }
  }

  async init(): Promise<void> {
    if (!this.authToken) {
      await this.authenticate();
    }
  }

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

      const queryParams = new URLSearchParams({
        station_id: stationId,
        ft: ft, // そのまま使用（すでにJST形式）
        to: to, // そのまま使用（すでにJST形式）
        l: "15",
      });

      const response = await this.proxyFetch(
        `v2/api/ts/playlist.m3u8?${queryParams}`
      );

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
        JSON.stringify(this.getDefaultHeaders())
      );

      return proxyUrl.toString();
    } catch (error) {
      console.error("Stream URL error:", error);
      throw error;
    }
  }
}
