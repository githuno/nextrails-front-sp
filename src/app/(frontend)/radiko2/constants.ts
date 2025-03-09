
// バックエンドAPIのURL
const RadikoApi = `${process.env.NEXT_PUBLIC_API_BASE}/radiko`;
export const url = {
  authIp: `${RadikoApi}/auth?ip={ip}` as const,
  stations: `${RadikoApi}/stations/{area}` as const,
  programNow: `${RadikoApi}/programs/now/{area}?token={token}` as const,
  // programsDate: `${RadikoApi}/programs?type=date&stationId={stationId}&date={date}&ip={ip}` as const,
  programsDate: `${RadikoApi}/programs/date?stationId={stationId}&date={date}&token={token}` as const,
  // programsToday: `${RadikoApi}/programs?type=today&stationId={stationId}&ip={ip}` as const,
  programsToday: `${RadikoApi}/programs/today?stationId={stationId}&token={token}` as const,
  // programsWeekly: `${RadikoApi}/programs?type=weekly&stationId={stationId}&ip={ip}` as const,
  programsWeekly: `${RadikoApi}/programs/weekly?stationId={stationId}&token={token}` as const,
  // liveStreaming: `${RadikoApi}/stream/{stationId}/l?ft={ft}&to={to}&ip={ip}` as const,
  liveStreaming: `${RadikoApi}/stream/{stationId}/l?token={token}` as const,
  // timeFreeStreaming: `${RadikoApi}/stream/{stationId}/t?ft={ft}&to={to}&ip={ip}` as const,
  timeFreeStreaming: `${RadikoApi}/stream/{stationId}/t?ft={ft}&to={to}&token={token}` as const,
  // カスタム
  customAuth: `${RadikoApi}/custom/auth` as const,
} as const;

// 地域ID型定義
export type RegionId = keyof typeof areaListParRegion;

// エリアID型定義
export type AreaId =
  | (typeof areaListParRegion)[RegionId][number]["id"]
  | "none";

export const regions = [
  { id: "hokkaido-tohoku", name: "北海道・東北" },
  { id: "kanto", name: "関東" },
  { id: "hokuriku-koushinetsu", name: "北陸・甲信越" },
  { id: "chubu", name: "中部" },
  { id: "kinki", name: "近畿" },
  { id: "chugoku-shikoku", name: "中国・四国" },
  { id: "kyushu", name: "九州・沖縄" },
] as const;

export const areaListParRegion = {
  "hokkaido-tohoku": [
    { id: "JP1", name: "北海道" },
    { id: "JP2", name: "青森" },
    { id: "JP3", name: "岩手" },
    { id: "JP4", name: "宮城" },
    { id: "JP5", name: "秋田" },
    { id: "JP6", name: "山形" },
    { id: "JP7", name: "福島" },
  ],
  kanto: [
    { id: "JP8", name: "茨城" },
    { id: "JP9", name: "栃木" },
    { id: "JP10", name: "群馬" },
    { id: "JP11", name: "埼玉" },
    { id: "JP12", name: "千葉" },
    { id: "JP13", name: "東京" },
    { id: "JP14", name: "神奈川" },
  ],
  "hokuriku-koushinetsu": [
    { id: "JP15", name: "新潟" },
    { id: "JP16", name: "富山" },
    { id: "JP17", name: "石川" },
    { id: "JP18", name: "福井" },
    { id: "JP19", name: "山梨" },
    { id: "JP20", name: "長野" },
  ],
  chubu: [
    { id: "JP21", name: "岐阜" },
    { id: "JP22", name: "静岡" },
    { id: "JP23", name: "愛知" },
    { id: "JP24", name: "三重" },
  ],
  kinki: [
    { id: "JP25", name: "滋賀" },
    { id: "JP26", name: "京都" },
    { id: "JP27", name: "大阪" },
    { id: "JP28", name: "兵庫" },
    { id: "JP29", name: "奈良" },
    { id: "JP30", name: "和歌山" },
  ],
  "chugoku-shikoku": [
    { id: "JP31", name: "鳥取" },
    { id: "JP32", name: "島根" },
    { id: "JP33", name: "岡山" },
    { id: "JP34", name: "広島" },
    { id: "JP35", name: "山口" },
    { id: "JP36", name: "徳島" },
    { id: "JP37", name: "香川" },
    { id: "JP38", name: "愛媛" },
    { id: "JP39", name: "高知" },
  ],
  kyushu: [
    { id: "JP40", name: "福岡" },
    { id: "JP41", name: "佐賀" },
    { id: "JP42", name: "長崎" },
    { id: "JP43", name: "熊本" },
    { id: "JP44", name: "大分" },
    { id: "JP45", name: "宮崎" },
    { id: "JP46", name: "鹿児島" },
    { id: "JP47", name: "沖縄" },
  ],
} as const;

// エリアIDからエリア名へのマッピングを事前に構築
export const areaIdToNameMap: Record<AreaId, string> = Object.entries(
  areaListParRegion
).reduce(
  (map, [_, areas]) => {
    // 各地域の各エリアについて
    areas.forEach((area) => {
      map[area.id as AreaId] = area.name;
    });
    return map;
  },
  { none: "未判定" } as Record<AreaId, string>
);

// エリアIDから地域IDを取得
export function areaIdToRegionMap(areaId: AreaId): RegionId | undefined {
  for (const regionId in areaListParRegion) {
    const areas = areaListParRegion[regionId as RegionId];
    if (areas.some(area => area.id === areaId)) {
      return regionId as RegionId;
    }
  }
  return undefined;
}

// 型定義
export interface Auth {
  token: string;
  areaId: string;
  success?: boolean;
  timestamp?: number;
}

export interface Station {
  id: string;
  name: string;
  url?: string;
}

export interface StationResponse {
  data: Station[];
}

export interface Program {
  title: string;
  startTime: string;
  endTime: string;
  ft: string;
  to: string;
  url: string;
  station_id: string;
  info: string;
  pfm: string;
}

// ブラウザからIPアドレスを取得
export const getClientIP = async () => {
  const clientIp = await fetch("https://api.ipify.org?format=json")
    .then((response) => response.json())
    .then((data) => data.ip)
    .catch(() => undefined);
  return clientIp;
};

// 日時フォーマット用のヘルパー関数
export const formatRadikoTime = (timeStr: string): string => {
  if (!timeStr) return "";
  const hour = timeStr.substring(8, 10);
  const minute = timeStr.substring(10, 12);
  return `${hour}:${minute}`;
};

// 日付フォーマット用のヘルパー関数を追加
export const formatDisplayDate = (dateStr: string) => {
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6));
  const day = parseInt(dateStr.substring(6, 8));
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
};