const PROXY_URL = "/api/proxy/radiko";

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

    const response = await fetch(url.toString(), {
      ...options,
      headers: undefined,
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Proxy request failed: ${error}`);
    }

    return response;
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

      // console.log("Authentication successful with token:", this.authToken);
    } catch (error) {
      this.authToken = "";
      throw error;
    }
  }

  async init(): Promise<void> {
    try {
      await this.authenticate();
      this.areaId = await this.getAreaId();
    } catch (error) {
      console.error("Initialization failed:", error);
      this.authToken = "";
      this.areaId = "";
      throw error;
    }
  }

  private async getAreaId(): Promise<string> {
    const response = await this.proxyFetch("v2/area");
    const text = await response.text();
    const match = text.match(/"(.*?)"/);
    return match ? match[1] : "JP13"; // デフォルトは東京
  }

  // 認証トークンを取得するメソッドを追加
  getAuthToken(): string {
    return this.authToken;
  }

  async getStations() {
    if (!this.areaId) await this.init();
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
  }

  async getPrograms(stationId: string, date: Date) {
    if (!this.authToken) await this.init();
    // 日付フォーマットを修正（YYYYMMDD）
    const dateStr =
      date.getFullYear().toString() +
      String(date.getMonth() + 1).padStart(2, "0") +
      String(date.getDate()).padStart(2, "0");

    const response = await this.proxyFetch(
      `v3/program/station/date/${dateStr}/${stationId}.xml`
    );
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/xml");

    return Array.from(doc.querySelectorAll("prog")).map((prog) => ({
      title: prog.querySelector("title")?.textContent || "",
      startTime: prog.getAttribute("ft") || "",
      endTime: prog.getAttribute("to") || "",
      url: prog.querySelector("url")?.textContent || "",
    }));
  }

  async getStreamUrl(
    stationId: string,
    ft: string,
    to: string
  ): Promise<string> {
    try {
      if (!this.authToken) {
        await this.authenticate();
      }

      const queryParams = new URLSearchParams({
        station_id: stationId,
        ft,
        to,
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
      proxyUrl.searchParams.set("authToken", this.authToken);

      return proxyUrl.toString();
    } catch (error) {
      if (error instanceof Error && error.message.includes("401")) {
        await this.authenticate();
        return this.getStreamUrl(stationId, ft, to);
      }
      throw error;
    }
  }
}
