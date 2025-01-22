import { useCallback, useState } from "react";
import { useCloudStorage } from "@/components/camera/_utils";
import { File, Imageset } from "@/components/camera";
import { session } from "@/components";

interface CloudState {
  isFilesFetching: boolean; // filesを取得中
  isPosting: string[]; // file.idbIdを追加中
  isPutting: string[]; // file.idbIdを更新中
  isDeleting: string[]; // file.idbIdを削除中
}

enum Method {
  NOT = 0,
  GET = 1,
  POST = 2,
  PUT = 3,
  DELETE = 4,
}

class Cloud {
  private cloudStorage: ReturnType<typeof useCloudStorage>["cloudStorage"];
  private contentTypeToExtension: Record<
    string,
    { class: string; ext: string }
  >;
  private state: CloudState = {
    isFilesFetching: false,
    isPosting: [],
    isPutting: [],
    isDeleting: [],
  };
  private setState: React.Dispatch<React.SetStateAction<CloudState>>;

  constructor(setState: React.Dispatch<React.SetStateAction<CloudState>>) {
    const { cloudStorage, contentTypeToExtension } = useCloudStorage();
    this.cloudStorage = cloudStorage;
    this.contentTypeToExtension = contentTypeToExtension;
    this.setState = setState;
  }

  private updateState(newState: Partial<CloudState>) {
    this.state = { ...this.state, ...newState };
    this.setState(this.state);
  }

  // imagesetsを取得して返す
  public getImagesets = useCallback(
    async ({ params }: { params?: string }): Promise<Imageset[]> => {
      try {
        const response = await fetch(
          params
            ? `${process.env.NEXT_PUBLIC_API_BASE}/imagesets?${params}`
            : `${process.env.NEXT_PUBLIC_API_BASE}/imagesets`
        );
        if (!response.ok) {
          throw new Error(`Response not ok: ${response.status}`);
        }
        const cloudImagesets = await response.json().then(async (json) => {
          const imagesets = await Promise.all(
            json.map(async (imageset: Imageset) => {
              if (!imageset) {
                return null; // imagesetがundefinedの場合はnullを返す
              }
              // 1. filesプロパティが存在しない場合や、値が配列でない場合に空の配列を設定
              imageset.files = Array.isArray(imageset.files)
                ? imageset.files
                : [];
              if (!imageset.files.length) {
                return imageset;
              }

              // 2. filesプロパティの各要素にblobをセット
              imageset.files = await Promise.all(
                imageset.files.map(async (file: File) => {
                  // 2-1. blobをDLしてセット
                  const blobs: (Blob | null)[] = await this.cloudStorage
                    .download({ keys: [file.key ?? ""] })
                    .catch((error: Error): (Blob | null)[] => {
                      console.error("Error downloading blobs:", error);
                      return [null]; // エラーの場合はnullを返すか、適切な処理をする
                    });
                  file.blob = blobs[0] as Blob;

                  // 2-2. IDB用のidをセット
                  file.idbId =
                    file.key
                      ?.split("/")
                      .pop()
                      ?.replace(/\.[^/.]+$/, "") || "";
                  // 2-3. 同期不要フラグをセット
                  file.shouldSync = false;
                  // 2-4. 削除済みファイルについてはそもそもcloudから返ってこないため考慮不要
                  //
                  return file;
                })
              );
              return imageset;
            })
          );
          // nullは除外して返す
          return imagesets.filter((imageset) => imageset !== null);
        });
        return cloudImagesets;
      } catch (error) {
        console.error("Error fetching media:", error);
        return [];
      }
    },
    []
  );

  // imageset.filesを取得して返す
  public getFiles = useCallback(
    async (
      imagesetName: string,
      options?: { params: string }
    ): Promise<File[]> => {
      this.updateState({ isFilesFetching: true });
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/files?name=${imagesetName}${
            options ? `&${options.params}` : ""
          }`
        );
        if (!response.ok) {
          throw new Error(`Response not ok: ${response.status}`);
        }

        const cloudFiles: File[] = await response.json().then(async (json) => {
          // 1. keyを取得
          const keys = json
            .filter((file: File) => !file.deletedAt || !file.idbUrl) // 削除済みorIDB保存済みファイルはkeysから除外してblobは取得しない
            .map((file: File) => file.key);

          // 2. keyからblobをダウンロード
          const blobs: Blob[] = await this.cloudStorage
            .download({ keys })
            .catch((error: Error) => {
              console.error("Error downloading blobs:", error);
              return [] as Blob[]; // エラーの場合は空の配列を返すか、適切な処理をする
            });

          // 3. ファイルにblobをセット
          const files = json.map((file: File) => {
            // 3-1. keyからidbIdを取得
            file.idbId =
              file.key
                ?.split("/")
                .pop()
                ?.replace(/\.[^/.]+$/, "") || "";
            // 3-2. 同期不要フラグをセット
            file.shouldSync = false;
            // 3-3. 削除済みファイルはblobを付与しない ※idb上で削除されず、cloud上では削除されたファイルを考慮
            if (!file.deletedAt) {
              const blobIndex = keys.indexOf(file.key);
              if (blobIndex !== -1 && blobs[blobIndex]) {
                file.blob = blobs[blobIndex];
              } else {
                console.error(`Failed to fetch blob for ${file.key}`);
              }
            }
            return file;
          });
          // 4. blobをセットしたファイルを返す
          return files;
        });
        return cloudFiles;
      } catch (error) {
        console.error("Error fetching media:", error);
        return [];
      } finally {
        this.updateState({ isFilesFetching: false });
      }
    },
    []
  );

  // imageset.fileを更新する
  public putFile = useCallback(
    async ({
      imagesetName,
      file,
    }: {
      imagesetName: string;
      file: File;
    }): Promise<void> => {
      this.updateState({ isPutting: [...this.state.isPutting, file.idbId] });
      try {
        if (!file.id || !file.version || !file.createdAt || !file.updatedAt)
          return;
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/files/${file.id}?name=${imagesetName}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(file),
          }
        );
        if (!response.ok) {
          throw new Error(`Failed to update file: ${response.statusText}`);
        }
      } catch (error) {
        console.error("Error updating files:", error);
      } finally {
        this.updateState({
          isPutting: this.state.isPutting.filter((id) => id !== file.idbId),
        });
      }
    },
    []
  );

  // imageset.fileを追加して返す
  public postFile = useCallback(
    async ({
      imagesetName,
      file,
    }: {
      imagesetName: string;
      file: File;
    }): Promise<File> => {
      this.updateState({ isPosting: [...this.state.isPosting, file.idbId] });
      try {
        if (!file.contentType || !file.idbUrl || !file.idbId) {
          throw new Error("Invalid file data");
        }

        // 1. CloudStrageにアップロードしてkeyを取得
        const type = this.contentTypeToExtension[file.contentType];
        file.key = await this.cloudStorage.upload({
          storagePath: `users/${session.userId}/${imagesetName}/${type.class}/${file.idbId}.${type.ext}`,
          fileId: file.idbId,
          filePath: file.idbUrl,
          contentType: file.contentType,
        });

        // 2. CloudにファイルをPOST
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/files?name=${imagesetName}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(file),
          }
        );
        if (!response.ok) {
          throw new Error(`Failed to upload file: ${response.statusText}`);
        }
        const updatedFile = await response.json();
        // 3-1. keyからidbIdを取得
        updatedFile.idbId =
          updatedFile.key
            ?.split("/")
            .pop()
            ?.replace(/\.[^/.]+$/, "") || "";
        // 3-2. 同期不要フラグを立てる
        updatedFile.shouldSync = false;
        // 4. 更新されたファイルを返す
        return updatedFile as File;
      } catch (error) {
        console.error("Error uploading files:", error);
        return Promise.reject(error);
      } finally {
        this.updateState({
          isPosting: this.state.isPosting.filter((id) => id !== file.idbId),
        });
      }
    },
    []
  );

  // imageset.fileを論理削除する
  public deleteFile = useCallback(
    async ({
      imagesetName,
      file,
    }: {
      imagesetName: string;
      file: File;
    }): Promise<void> => {
      this.updateState({ isDeleting: [...this.state.isDeleting, file.idbId] });
      try {
        if (!file.id || !file.version || !file.updatedAt || !file.deletedAt)
          throw new Error("Invalid file data");
        await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE}/files/${file.id}/s?name=${imagesetName}`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(file),
          }
        );
      } catch (error) {
        console.error("Error updating files:", error);
      } finally {
        this.updateState({
          isDeleting: this.state.isDeleting.filter((id) => id !== file.idbId),
        });
      }
    },
    []
  );

  // Fileの状態に応じて処理を分岐
  public shouldDo = (file: File): Method => {
    if (file.size === 0 || !file.shouldSync) return Method.NOT; // ファイルのサイズプロパティが0（まだIDBに保存されていない仮ファイル）
    if (file.deletedAt) return Method.DELETE;
    if (file.id && file.version) return Method.PUT;
    if (!file.id) return Method.POST;
    return Method.NOT;
  };
}

const useCloudImg = () => {
  const [cloudState, setCloudState] = useState<CloudState>({
    isFilesFetching: false,
    isPosting: [],
    isPutting: [],
    isDeleting: [],
  });
  const cloud = new Cloud(setCloudState);
  const isOnline = navigator.onLine;

  return { cloud, cloudState, isOnline };
};

export { useCloudImg, Method as ShouldDo };
