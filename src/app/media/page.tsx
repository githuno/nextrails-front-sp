"use client";
import React, { useState, useEffect, useRef, Suspense } from "react";
import { openDB } from "idb";
import { isMobile } from "react-device-detect";
import { useToast } from "@/hooks/toast"

let mediaRecorder: MediaRecorder;
let recordedBlobs: Blob[] = [];

const MediaCaptureVeiwer = ({
  setStream,
}: {
  setStream: React.Dispatch<React.SetStateAction<MediaStream | null>>;
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setLocalStream] = useState<MediaStream | null>(null);

  const getMediaSuccess = (stream: MediaStream) => {
    setStream(stream);
    setLocalStream(stream);
  };

  const getMediaError = (error: Error) => {
    console.error("Camera Device Not Found: ", error);
    // alert("カメラにアクセスできません。カメラが存在し、接続されていること、\
    // または他のアプリケーションによって使用されていないことを確認してください。\
    // また、ブラウザにカメラへのアクセスを許可していることを確認してください。");
  };

  const getMedia = () => {
    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: {
            exact: "environment", // リアカメラを指定
          },
        },
        audio: false,
      })
      .then(getMediaSuccess)
      .catch((err) => {
        navigator.mediaDevices
          .getUserMedia({
            video: true,
            audio: false,
          })
          .then(getMediaSuccess)
          .catch(() => {
            getMediaError(err);
          });
      });
  }

  // const getAspectRatio = () => {
  //   if (videoRef.current) {
  //     const aspectRatio = videoRef.current.videoWidth / videoRef.current.videoHeight;
  //     return aspectRatio;
  //   }
  //   return 0;
  // }

  useEffect(() => { // マウント時に実行 -> getMedia()を実行
    getMedia();
    return () => {
      if (stream) {
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      if (mediaRecorder) {
        mediaRecorder.stop();
      }
    };
  }, []);

  useEffect(() => { // streamが更新されたら実行 -> videoRefにstreamをセット
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div>
      <video ref={videoRef} autoPlay muted />
    </div>
  );
};

const MediaCaptureButton = ({
  stream,
  setVideoId,
}: {
  stream: MediaStream | null;
  setVideoId: React.Dispatch<React.SetStateAction<number | null>>;
}) => {
  const [recording, setRecording] = useState(false);

  const handleStartRecording = () => {
    if (stream) {
      recordedBlobs = []; // recordedBlobs を初期化
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedBlobs.push(event.data);
        }
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedBlobs, { type: "video/webm" });
        saveRecording(blob);
      };
      mediaRecorder.start();
      setRecording(true);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setRecording(false);
    }
  };

  const saveRecording = async (blob: Blob) => {
    let db = await openDB("recordings", 2, {
      upgrade(db) {
        db.createObjectStore("videos", { keyPath: "id", autoIncrement: true});
      },
    });
    let tx = db.transaction("videos", "readwrite");
    let videos = tx.objectStore("videos");
    await videos.clear(); // addする前にすべてのデータを削除する
    const video = await videos.add(blob, isMobile? Math.random() : undefined); // mobileとPCで成功条件が違った。2024/01/14
    setVideoId(Number(video));
  };

  return (
    <div>
      <button onClick={recording ? handleStopRecording : handleStartRecording}>
        {recording ? "Stop" : "REC"}
      </button>
    </div>
  );
};

const VideoPlayButton = ({
  videoId,
  setRecordedVideo,
}: {
  videoId: number | null;
  setRecordedVideo: React.Dispatch<React.SetStateAction<string | null>>;
}) => {
  const playRecordedVideo = async () => {
    const db = await openDB("recordings", 2);
    const tx = db.transaction("videos", "readonly");

    // オブジェクトストアの中身を一覧で取得
    const allVideos = await tx.objectStore("videos").getAll(); // debug
    console.log("allVideos", allVideos); // debug -> OK!!

    const videoBlob = await tx
      .objectStore("videos")
      .get(videoId as IDBKeyRange | IDBValidKey);

    if (videoBlob) {
      const videoBlobUrl = URL.createObjectURL(videoBlob);
      setRecordedVideo(videoBlobUrl);

      // コンポーネントが unmount された後も URL を解放するための処理
      return () => {
        URL.revokeObjectURL(videoBlobUrl);
      };
    }
  };

  return (
    <div>
      <button onClick={playRecordedVideo}>Play Recorded Video</button>
    </div>
  );
};

export default function MediaCapture() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recordedVideo, setRecordedVideo] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [videoId, setVideoId] = useState<number | null>(null);
  // サーバーサイドとクライアントサイドで同じメッセージを表示する
  const loadingMessage = "Loading...";
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div>{loadingMessage}</div>;
  }

  console.log("MediaCapture実行"); // debug
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div id="media-container" className="min-h-7/10 bg-gray-200 rounded-lg shadow-lg">
        <MediaCaptureVeiwer
          setStream={setStream}
        />
      </div>
      <div className="flex items-center justify-center w-24 h-24 bg-blue-500 rounded-full shadow-lg">
        <MediaCaptureButton stream={stream} setVideoId={setVideoId} />
      </div>
      {recordedVideo && <video controls src={recordedVideo} />}
      <VideoPlayButton videoId={videoId} setRecordedVideo={setRecordedVideo} />
    </main>
  );
}

// indexedDBのデータを一覧化する（getIndexedDbボタン）-> (play)(delete)
// uploadボタンを作成する->create3D（uploadボタン<createObject && create3D>）
// CloudDB（Objects）のデータを一覧化する（getObjectsボタン） -> (play)(delete)

// -- CloudDB（images）のデータを一覧化する
// -- CloudDB（image）のデータを削除する


// // Error Boundary コンポーネント
// type Props = {
//   children: React.ReactNode;
// };

// class ErrorBoundary extends React.Component<Props> {
//   state = { hasError: false };

//   static getDerivedStateFromError(error: Error) {
//     return { hasError: true };
//   }

//   render() {
//     if (this.state.hasError) {
//       return <h1>エラーが発生しました。</h1>;
//     }

//     return this.props.children;
//   }
// }

// // サスペンスとError Boundaryでラップ
// const App = () => (
//   <ErrorBoundary>
//     <Suspense fallback={<div>Loading...</div>}>
//       <MediaCapture />
//     </Suspense>
//   </ErrorBoundary>
// );

// export default App;