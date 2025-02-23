// バックエンドAPIのURL
const RadikoApi = `${process.env.NEXT_PUBLIC_API_BASE}/radiko`;
// ローカルストレージキー
const PLAYBACK_STATE_KEY = "radiko_playback_state";
const IP_STORAGE_KEY = "radiko_ip_address";

// 都道府県とエリアIDのマッピング
const AREA_PREFECTURE_MAP = {
  JP1: "北海道",
  JP2: "青森県",
  JP3: "岩手県",
  JP4: "宮城県",
  JP5: "秋田県",
  JP6: "山形県",
  JP7: "福島県",
  JP8: "茨城県",
  JP9: "栃木県",
  JP10: "群馬県",
  JP11: "埼玉県",
  JP12: "千葉県",
  JP13: "東京都",
  JP14: "神奈川県",
  JP15: "新潟県",
  JP16: "富山県",
  JP17: "石川県",
  JP18: "福井県",
  JP19: "山梨県",
  JP20: "長野県",
  JP21: "岐阜県",
  JP22: "静岡県",
  JP23: "愛知県",
  JP24: "三重県",
  JP25: "滋賀県",
  JP26: "京都府",
  JP27: "大阪府",
  JP28: "兵庫県",
  JP29: "奈良県",
  JP30: "和歌山県",
  JP31: "鳥取県",
  JP32: "島根県",
  JP33: "岡山県",
  JP34: "広島県",
  JP35: "山口県",
  JP36: "徳島県",
  JP37: "香川県",
  JP38: "愛媛県",
  JP39: "高知県",
  JP40: "福岡県",
  JP41: "佐賀県",
  JP42: "長崎県",
  JP43: "熊本県",
  JP44: "大分県",
  JP45: "宮崎県",
  JP46: "鹿児島県",
  JP47: "沖縄県",
} as const;

// 型定義
// interface Result<T> {
//   data: T;
//   error?: Error;
// }

interface Station {
  id: string;
  name: string;
  url: string;
}

interface Program {
  title: string;
  startTime: string;
  endTime: string;
  ft: string;
  to: string;
  url: string;
}

interface PlaybackState {
  stationId: string;
  programStartTime: string;
  programEndTime: string;
  currentTime: number;
  playbackRate: number;
  program: Program;
}

// 日時フォーマット用のヘルパー関数
const formatRadikoTime = (timeStr: string): string => {
  if (!timeStr) return "";
  const jstDate = new Date(
    parseInt(timeStr.substring(0, 4)),
    parseInt(timeStr.substring(4, 6)) - 1,
    parseInt(timeStr.substring(6, 8)),
    parseInt(timeStr.substring(8, 10)),
    parseInt(timeStr.substring(10, 12))
  );

  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tokyo",
  }).format(jstDate);
};

// 日付フォーマット用のヘルパー関数を追加
const formatDisplayDate = (dateStr: string) => {
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6));
  const day = parseInt(dateStr.substring(6, 8));
  const date = new Date(year, month - 1, day);
  
  return date.toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
};

export {
  RadikoApi,
  PLAYBACK_STATE_KEY,
  IP_STORAGE_KEY,
  AREA_PREFECTURE_MAP,
  formatRadikoTime,
  formatDisplayDate,
  type Station,
  type Program,
  type PlaybackState,
}