const PROXY_URL = "/api/proxy/radiko";
const AUTH_TOKEN_KEY = "radiko_auth_token";
const AREA_ID_KEY = "radiko_area_id";

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

export class RadikoClient {
  private authToken: string = "";
  private areaId: string = "";

  constructor() {
    // キャッシュから認証情報を復元
    if (typeof window !== "undefined") {
      this.authToken = sessionStorage.getItem(AUTH_TOKEN_KEY) || "";
      this.areaId = sessionStorage.getItem(AREA_ID_KEY) || "";
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      "X-Radiko-App": "pc_html5",
      "X-Radiko-App-Version": "0.0.1",
      "X-Radiko-User": "dummy_user",
      "X-Radiko-Device": "pc",
      ...(this.authToken && { "X-Radiko-AuthToken": this.authToken }),
    };
  }

  private async proxyFetch(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = new URL(PROXY_URL, window.location.origin);
    url.searchParams.set("path", path);
    url.searchParams.set(
      "headers",
      JSON.stringify({
        ...this.getHeaders(),
        ...options.headers,
      })
    );

    const response = await fetch(url.toString(), {
      ...options,
      headers: undefined,
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 401) {
        // 認証エラー時は認証情報をクリアして再認証
        this.clearAuth();
        await this.authenticate();
        return this.proxyFetch(path, options);
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  }

  private async authenticate(): Promise<void> {
    const auth1Response = await this.proxyFetch("v2/api/auth1");
    const authToken = auth1Response.headers.get("x-radiko-authtoken");
    const keyOffset = auth1Response.headers.get("x-radiko-keyoffset");
    const keyLength = auth1Response.headers.get("x-radiko-keylength");

    if (!authToken || !keyOffset || !keyLength) {
      throw new Error("Authentication failed: Missing headers");
    }

    this.authToken = authToken;
    const partialKey = this.generatePartialKey(
      parseInt(keyOffset),
      parseInt(keyLength)
    );

    const auth2Response = await this.proxyFetch("v2/api/auth2", {
      headers: { "X-Radiko-Partialkey": partialKey },
    });

    if (!auth2Response.ok) {
      throw new Error("Authentication failed at auth2");
    }

    sessionStorage.setItem(AUTH_TOKEN_KEY, this.authToken);
  }

  private generatePartialKey(offset: number, length: number): string {
    const AUTH_KEY = "bcd151073c03b352e1ef2fd66c32209da9ca0afa";
    return btoa(AUTH_KEY.substring(offset, offset + length));
  }

  private clearAuth(): void {
    this.authToken = "";
    this.areaId = "";
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(AREA_ID_KEY);
  }

  async init(): Promise<void> {
    if (!this.authToken) {
      await this.authenticate();
    }
    if (!this.areaId) {
      this.areaId = await this.getAreaId();
      sessionStorage.setItem(AREA_ID_KEY, this.areaId);
    }
  }

  private async getAreaId(): Promise<string> {
    try {
      const response = await this.proxyFetch("v2/area");
      const text = await response.text();
      const match = text.match(/"(.*?)"/);
      return match?.[1] || "JP13";
    } catch {
      return "JP13";
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

      const queryParams = new URLSearchParams({
        station_id: stationId,
        ft: ft,
        to: to,
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
          ...this.getHeaders(),
          "X-Radiko-AuthToken": this.authToken,
        })
      );

      return proxyUrl.toString();
    } catch (error) {
      console.error("Stream URL error:", error);
      throw error;
    }
  }
}
