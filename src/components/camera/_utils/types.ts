interface Media {
  id: string;
  url: string | null;
  blob: Blob;
  isUploaded: boolean;
  type: "image" | "video";
}

type CameraState =
  | "initializing"
  | "scanning"
  | "recording"
  | "capturing"
  | "saving"
  | "waiting";

export type { Media, CameraState };
