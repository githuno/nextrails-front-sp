import { start } from "repl";

const PROXY_URL = `${process.env.NEXT_PUBLIC_API_BASE}/proxy/radiko`;
const AUTH_KEY = process.env.NEXT_PUBLIC_RADIKO_AUTH_KEY || "";

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
      const auth1Headers = {
        "X-Radiko-App": "pc_html5",
        "X-Radiko-App-Version": "0.0.1",
        "X-Radiko-User": "dummy_user",
        "X-Radiko-Device": "pc",
        // 追加のヘッダー
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        Accept: "*/*",
        Origin: "https://radiko.jp",
        Referer: "https://radiko.jp/",
      };

      // 認証1
      const auth1Response = await this.proxyFetch("v2/api/auth1", {
        headers: auth1Headers,
      });
      if (!auth1Response.ok) {
        throw new Error(`Auth1 failed: ${auth1Response.status}`);
      }

      // JSONとして認証情報を取得
      const authInfo = await auth1Response.json();
      const authToken = authInfo.authtoken;

      const keyOffset = parseInt(authInfo.keyoffset);
      const keyLength = parseInt(authInfo.keylength);
      // const keyOffset = authInfo.keyoffset;
      // const keyLength = authInfo.keylength;
      // if (!authToken || !keyOffset || !keyLength) {
      //   throw new Error("Authentication failed: Missing auth1 headers");
      // }

      // partialKeyの生成を修正
      const partialKey = window.btoa(
        AUTH_KEY.slice(keyOffset, keyOffset + keyLength)
      );
      // const offset = parseInt(keyOffset);
      // const length = parseInt(keyLength);
      // const partialKey = btoa(AUTH_KEY.substring(offset, offset + length));

      // 認証2
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

      this.authToken = authToken;
      await this.fetchAreaId();
    } catch (error) {
      this.authToken = "";
      this.areaId = "";
      throw error;
    }
  }

  private async fetchAreaId(): Promise<void> {
    try {
      const response = await this.proxyFetch("v2/api/auth2");
      const areaId = response.headers.get("x-radiko-areaid");
      this.areaId = areaId || "JP13";
    } catch (error) {
      console.error("Failed to fetch area ID:", error);
      this.areaId = "JP13";
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

  private async proxyFetch(
    path: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = new URL(PROXY_URL);
    url.searchParams.set("path", path);

    const headers = {
      ...this.getDefaultHeaders(),
      ...(options.headers || {}),
    };

    url.searchParams.set("headers", JSON.stringify(headers));

    try {
      const response = await fetch(url.toString(), {
        ...options,
        headers: undefined,
        credentials: "include",
        cache: "no-store",
      });

      // エラー処理
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
      return [];
    }
  }

  async getPrograms(stationId: string, date: Date) {
    try {
      if (!this.authToken) await this.init();

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
      return [];
    }
  }

  async getStreamUrl(
    stationId: string,
    ft: string,
    to: string,
    clientIP: string,
    startPosition?: number // 追加
  ): Promise<{ url: string; offset: number }> {
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
            ...this.getDefaultHeaders(),
            "X-Client-IP": clientIP,
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

      // チャンクリストURLもプロキシ経由でアクセス
      const proxyUrl = new URL(PROXY_URL);
      proxyUrl.searchParams.set("path", masterPlaylistUrl);
      proxyUrl.searchParams.set(
        "headers",
        JSON.stringify({
          ...this.getDefaultHeaders(),
          "X-Client-IP": clientIP,
        })
      );

      // 開始時刻からのオフセットを計算
      const offset = startPosition || 0;

      return {
        url: proxyUrl.toString(),
        offset,
      };
    } catch (error) {
      console.error("Stream URL error:", error);
      throw error;
    }
  }
}
