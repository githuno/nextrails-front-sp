import React from "react"

// TODO: リファクタリング→https://react-svgr.com/playground/で変換
// TODO: publicに置く場合とパフォーマンス比較

interface IconProps {
  size?: string
  color?: string
  strokeColor?: string
  strokeWidth?: string
}

// ヘルパー関数でサイズを解析: Tailwindクラスとpx値の両方をサポート
const parseSize = (size: string): { width: string; height: string } => {
  if (size.includes("px")) {
    return { width: size, height: size }
  }
  // "h-6 w-6" のようなTailwindクラスを解析
  const classes = size.split(" ")
  let width = "24px" // デフォルト
  let height = "24px"
  for (const cls of classes) {
    if (cls.startsWith("w-")) {
      const num = parseInt(cls.slice(2))
      width = `${num * 4}px` // Tailwindスペーシングスケール: h-1 = 4px, h-6 = 24px
    }
    if (cls.startsWith("h-")) {
      const num = parseInt(cls.slice(2))
      height = `${num * 4}px`
    }
  }
  return { width, height }
}

const LoadingDot: React.FC<IconProps> = ({ size = "36px", color = "#09f" }) => {
  const dotSize = `w-2 h-2`
  const animationDelay = ["0s", "0.2s", "0.4s"]
  return (
    <div className="flex items-center justify-center space-x-1" style={{ width: size, height: size }}>
      {animationDelay.map((delay, index) => (
        <div
          key={index}
          className={`${dotSize} animate-pulse rounded-full`}
          style={{ backgroundColor: color, animationDelay: delay, animationDuration: "1.5s" }}
        ></div>
      ))}
    </div>
  )
}

const LoadingSpinner: React.FC<IconProps & { dotSize?: string; mode?: "loading" | "sync"; isSpinning?: boolean }> = ({
  size = "36px",
  color = "#09f",
  dotSize = "w-1 h-1",
  mode = "loading",
  isSpinning = true,
}) => {
  const angles = mode === "loading" ? [0, 45, 90, 135] : [0, 180]
  const animationDelay = ["0s", "0.15s", "0.3s", "0.45s"]

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div
        className={`relative h-full w-full ${isSpinning ? (mode === "loading" ? "animate-spin-linear" : "animate-sync-orbit") : ""}`}
      >
        {angles.map((angle, index) => (
          <div key={index} className="absolute inset-0" style={{ transform: `rotate(${angle}deg)` }}>
            <div
              className={`${dotSize} absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${isSpinning ? (mode === "sync" ? "animate-sync-dot" : "animate-loading-dot") : ""}`}
              style={{
                backgroundColor: color,
                animationDelay: animationDelay[index],
                opacity: isSpinning ? 1 : 0.3,
              }}
            ></div>
          </div>
        ))}
      </div>
      <style>{`
        .animate-spin-linear {
          animation: spin 1s linear infinite;
        }
        .animate-sync-orbit {
          animation: spin 3s cubic-bezier(0.65, 0, 0.35, 1) infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .animate-loading-dot {
          animation: loading-pulse 1.5s ease-in-out infinite;
        }
        @keyframes loading-pulse {
          0%,
          100% {
            transform: translate(-50%, -12px) scale(0.8);
            opacity: 0.3;
          }
          50% {
            transform: translate(-50%, -12px) scale(1.2);
            opacity: 1;
          }
        }
        .animate-sync-dot {
          animation: sync-breath 3s ease-in-out infinite;
        }
        @keyframes sync-breath {
          0%,
          100% {
            transform: translate(-50%, -8px) scale(0.7);
            opacity: 0.5;
          }
          50% {
            transform: translate(-50%, -16px) scale(1.3);
            opacity: 1;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-spin-linear,
          .animate-sync-orbit,
          .animate-loading-dot,
          .animate-sync-dot {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}

const CloseIcon = ({ size = "h-5 w-5", color = "bg-current" }: { size?: string; color?: string }) => {
  const isPixelSize = size.includes("px")
  const isHexColor = color.startsWith("#")
  return (
    <div className={`relative ${isPixelSize ? "" : size}`} style={isPixelSize ? { width: size, height: size } : {}}>
      <span
        className={`absolute top-1/2 left-1/2 h-0.5 w-full -translate-x-1/2 -translate-y-1/2 rotate-45 transform ${isHexColor ? "" : color}`}
        style={isHexColor ? { backgroundColor: color } : {}}
      ></span>
      <span
        className={`absolute top-1/2 left-1/2 h-0.5 w-full -translate-x-1/2 -translate-y-1/2 -rotate-45 transform ${isHexColor ? "" : color}`}
        style={isHexColor ? { backgroundColor: color } : {}}
      ></span>
    </div>
  )
}

const PrevIcon = ({ size = "h-4 w-4", color = "text-white" }: { size?: string; color?: string }) => {
  const isPixelSize = size.includes("px")
  const isHexColor = color.startsWith("#")
  return (
    <div className={`relative ${isPixelSize ? "" : size}`} style={isPixelSize ? { width: size, height: size } : {}}>
      <span
        className={`absolute top-1/2 left-1/2 h-0.5 w-2 ${isHexColor ? "" : color.replace("text-", "bg-")} origin-left -translate-x-1/2 -translate-y-1/2 rotate-45 transform`}
        style={isHexColor ? { backgroundColor: color } : {}}
      ></span>
      <span
        className={`absolute top-1/2 left-1/2 h-0.5 w-2 ${isHexColor ? "" : color.replace("text-", "bg-")} origin-left -translate-x-1/2 -translate-y-1/2 -rotate-45 transform`}
        style={isHexColor ? { backgroundColor: color } : {}}
      ></span>
    </div>
  )
}

const NextIcon = ({ size = "h-4 w-4", color = "text-white" }: { size?: string; color?: string }) => {
  const isPixelSize = size.includes("px")
  const isHexColor = color.startsWith("#")
  return (
    <div className={`relative ${isPixelSize ? "" : size}`} style={isPixelSize ? { width: size, height: size } : {}}>
      <span
        className={`absolute top-1/2 left-1/2 h-0.5 w-2 ${isHexColor ? "" : color.replace("text-", "bg-")} origin-right -translate-x-1/2 -translate-y-1/2 -rotate-45 transform`}
        style={isHexColor ? { backgroundColor: color } : {}}
      ></span>
      <span
        className={`absolute top-1/2 left-1/2 h-0.5 w-2 ${isHexColor ? "" : color.replace("text-", "bg-")} origin-right -translate-x-1/2 -translate-y-1/2 rotate-45 transform`}
        style={isHexColor ? { backgroundColor: color } : {}}
      ></span>
    </div>
  )
}

const MenuIcon = ({ size = "h-6 w-6", color = "bg-current" }: { size?: string; color?: string }) => {
  const isPixelSize = size.includes("px")
  const isHexColor = color.startsWith("#")
  return (
    <div
      className={`flex flex-col items-center justify-center ${isPixelSize ? "" : size}`}
      style={isPixelSize ? { width: size, height: size } : {}}
    >
      <span
        className={`block h-0.5 w-4 ${isHexColor ? "" : color} mb-1`}
        style={isHexColor ? { backgroundColor: color } : {}}
      ></span>
      <span
        className={`block h-0.5 w-4 ${isHexColor ? "" : color} mb-1`}
        style={isHexColor ? { backgroundColor: color } : {}}
      ></span>
      <span
        className={`block h-0.5 w-4 ${isHexColor ? "" : color}`}
        style={isHexColor ? { backgroundColor: color } : {}}
      ></span>
    </div>
  )
}

const StopIcon = ({ size = "h-8 w-8", color = "bg-red-500" }: { size?: string; color?: string }) => {
  const isPixelSize = size.includes("px")
  const isHexColor = color.startsWith("#")
  return (
    <div className={`relative ${isPixelSize ? "" : size}`} style={isPixelSize ? { width: size, height: size } : {}}>
      <div
        className={`absolute inset-0 ${isHexColor ? "" : color} rounded-full`}
        style={isHexColor ? { backgroundColor: color } : {}}
      ></div>
      <div className="absolute inset-2 rounded bg-white"></div>
    </div>
  )
}

const SyncIcon: React.FC<IconProps & { isSpinning?: boolean }> = ({
  size = "32px",
  color = "#4B4B4B",
  isSpinning = true,
}) => {
  return <LoadingSpinner size={size} color={color} mode="sync" isSpinning={isSpinning} dotSize="w-1.5 h-1.5" />
}

const PenIcon: React.FC<IconProps> = ({ size = "16px", color = "#4B4B4B" }) => {
  const { width, height } = parseSize(size)
  return (
    <svg
      version="1.1"
      id="_x32_"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      x="0px"
      y="0px"
      viewBox="0 0 512 512"
      style={{ width, height, opacity: 1 }}
      xmlSpace="preserve"
    >
      <style type="text/css">{`.st0{fill:${color};}`}</style>
      <g>
        <path
          className="st0"
          d="M165.628,461.127c0,0,0.827-0.828,1.838-1.839l194.742-194.742c1.012-1.011,1.92-1.92,2.019-2.019
          c0.099-0.099,1.008-1.008,2.019-2.019l103.182-103.182c0.018-0.018,0.018-0.048,0-0.067L354.259,42.092
          c-0.018-0.018-0.048-0.018-0.067,0L251.01,145.274c-1.011,1.011-1.92,1.92-2.019,2.019c-0.099,0.099-1.008,1.008-2.019,2.019
          L50.401,345.884c-0.006,0.006-0.01,0.012-0.012,0.02L0.002,511.459c-0.011,0.036,0.023,0.07,0.059,0.059l163.079-49.633
          C164.508,461.468,165.628,461.127,165.628,461.127z M36.734,474.727l25.159-82.666c0.01-0.034,0.053-0.045,0.078-0.02
          l57.507,57.507c0.025,0.025,0.014,0.068-0.02,0.078l-82.666,25.16C36.756,474.797,36.722,474.764,36.734,474.727z"
          style={{ fill: color }}
        />
        <path
          className="st0"
          d="M502.398,104.432c12.803-12.804,12.803-33.754,0-46.558l-47.791-47.792c-12.804-12.803-33.754-12.803-46.558,0
          l-23.862,23.862c-0.018,0.018-0.018,0.048,0,0.067l94.282,94.282c0.018,0.018,0.048,0.018,0.067,0L502.398,104.432z"
          style={{ fill: color }}
        />
      </g>
    </svg>
  )
}

const CameraIcon: React.FC<IconProps> = ({ size = "40px", color = "#4B4B4B" }) => {
  const { width, height } = parseSize(size)
  return (
    <svg
      version="1.1"
      id="_x32_"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      x="0px"
      y="0px"
      viewBox="0 0 512 512"
      style={{ width, height, opacity: 1 }}
      xmlSpace="preserve"
    >
      <g>
        <path
          d="M256,224.828c-34.344,0-62.156,28.078-62.156,62.719s27.813,62.719,62.156,62.719s62.156-28.078,62.156-62.719
    S290.344,224.828,256,224.828z"
          style={{ fill: color }}
        ></path>
        <path
          d="M478.766,135.75h-58.625c-13.078,0-24.938-7.75-30.297-19.781l-17.547-39.313
    c-5.359-12.016-17.234-19.766-30.313-19.766H170.016c-13.078,0-24.953,7.75-30.328,19.766l-17.531,39.313
    C116.797,128,104.938,135.75,91.859,135.75H33.234C14.875,135.75,0,150.766,0,169.266v252.328c0,18.5,14.875,33.516,33.234,33.516
    h244.25h201.281c18.344,0,33.234-15.016,33.234-33.516V169.266C512,150.766,497.109,135.75,478.766,135.75z M256,403.844
    c-63.688,0-115.297-52.063-115.297-116.297S192.313,171.234,256,171.234s115.297,52.078,115.297,116.313
    S319.688,403.844,256,403.844z"
          style={{ fill: color }}
        ></path>
      </g>
    </svg>
  )
}

const RecordIcon: React.FC<IconProps> = ({ size = "40px", color = "#4B4B4B" }) => {
  const { width, height } = parseSize(size)
  return (
    <svg
      version="1.1"
      id="_x32_"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      x="0px"
      y="0px"
      viewBox="0 0 512 512"
      style={{ width, height, opacity: 1 }}
      xmlSpace="preserve"
    >
      <style type="text/css">{`.st0{fill:${color};}`}</style>
      <path
        d="M289.375,40.703c-40.906,0-76.25,23.781-93,58.266c-16.75-34.484-52.109-58.266-93.016-58.266
        C46.266,40.703,0,86.969,0,144.063c0,57.078,46.266,103.328,103.359,103.328h186.016c57.094,0,103.359-46.25,103.359-103.328
        C392.734,86.969,346.469,40.703,289.375,40.703z M103.359,183.141c-21.594,0-39.094-17.516-39.094-39.078
        c0-21.594,17.5-39.094,39.094-39.094c21.563,0,39.063,17.5,39.063,39.094C142.422,165.625,124.922,183.141,103.359,183.141z
         M289.375,183.141c-21.578,0-39.063-17.516-39.063-39.078c0-21.594,17.484-39.094,39.063-39.094
  c21.594,0,39.094,17.5,39.094,39.094C328.469,165.625,310.969,183.141,289.375,183.141z"
        style={{ fill: color }}
      ></path>
      <path
        d="M332.125,271H53.828c-11.094,0-20.063,8.969-20.063,20.047v160.188c0,11.078,8.969,20.063,20.063,20.063
  h278.297c11.094,0,20.063-8.984,20.063-20.063V291.047C352.188,279.969,343.219,271,332.125,271z"
        style={{ fill: color }}
      ></path>
      <path
        d="M504.344,306.688c-4.844-3.797-11.172-5.156-17.156-3.719l-97.844,23.844c-9,2.188-15.328,10.25-15.328,19.5
  v47.484c0,9.25,6.328,17.297,15.328,19.484l97.844,23.859c5.984,1.438,12.313,0.078,17.156-3.719
  c4.828-3.813,7.656-9.625,7.656-15.781v-95.188C512,316.313,509.172,310.5,504.344,306.688z"
        style={{ fill: color }}
      ></path>
    </svg>
  )
}

const PictureIcon: React.FC<IconProps> = ({ size = "32px", color = "#4B4B4B" }) => {
  const { width, height } = parseSize(size)
  return (
    <svg
      version="1.1"
      id="_x32_"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      x="0px"
      y="0px"
      viewBox="0 0 512 512"
      style={{ width, height, opacity: 1 }}
      xmlSpace="preserve"
    >
      <style type="text/css">{`.st0{fill:${color};}`}</style>
      <g>
        <path
          className="st0"
          d="M84.523,84.523V512H512V84.523H84.523z M220.739,184.766c24.028,0,43.5,19.48,43.5,43.507
            c0,24.027-19.473,43.507-43.5,43.507c-24.027,0-43.507-19.48-43.507-43.507C177.232,204.246,196.712,184.766,220.739,184.766z
            M463.923,407.239c-1.494,2.776-4.398,4.517-7.556,4.517H140.156c-3.151,0-6.048-1.726-7.548-4.502
            c-1.501-2.777-1.359-6.153,0.375-8.787l55.311-84.276c3.669-5.59,9.732-9.154,16.403-9.627c6.679-0.472,13.185,2.192,17.612,7.212
            l38.15,43.236l69.125-105.196c3.962-6.026,10.693-9.665,17.904-9.672c7.211-0.008,13.95,3.617,17.92,9.635l98.127,148.666
            C465.273,401.086,465.424,404.463,463.923,407.239z"
          style={{ fill: color }}
        />
        <polygon
          className="st0"
          points="450.529,0 0,0 0,450.529 46.104,450.529 46.104,46.104 450.529,46.104"
          style={{ fill: color }}
        />
      </g>
    </svg>
  )
}

const SwitchCameraIcon: React.FC<IconProps> = ({ size = "24px", color = "#4B4B4B", strokeColor, strokeWidth }) => {
  const { width, height } = parseSize(size)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 225 225"
      fill="none"
      stroke={strokeColor}
      strokeWidth={strokeWidth}
      style={{ width, height }}
    >
      {/* Main body - くり抜き済みのパス */}
      <path
        d="
        M0 0 C25.2 0 25.2 0 27.58 1.56 C29.12 3.84 29.98 6.17 30.88 8.77 C32.69 14.2 32.69 14.2 32.69 16.2 H53.69 V81.2 H-35.31 V17.2 H-14.31 C-11.41 5.52 -10.64 3.42 -9.31 1.2 C-6.33 -0.29 -3.27 0 0 0 Z
        M 9.19, 40.6 m -15, 0 a 15,15 0 1,0 30,0 a 15,15 0 1,0 -30,0 Z
      "
        fill={color}
        fillRule="evenodd"
        transform="translate(103.309 39.797)"
      />

      {/* Left arm */}
      <path
        d="M0 0 C-8.45 13.35 -13.43 22.78 -13.43 22.78 C-12.24 31.91 -9 35.81 -9 35.81 C2.25 48.65 24 51.81 51 54.81 L43 44.81 C43 41.81 44 40.81 44 40.81 C48.53 40.49 51.1 42.25 68 58.81 C68 61.51 67.53 63.19 65.77 65.26 C60.75 69.81 55.6 74.35 51.25 78.7 C46.19 80.63 46.19 80.63 44 79.81 C43.19 77.64 43.19 77.64 43 74.81 L53 64.81 C27.61 62.82 1.28 58.3 -15 41.81 C-20.17 35.34 -22.68 30.22 -22 21.81 C-19.35 11.88 -13.56 5.8 -4.87 0.61 Z"
        fill={color}
        transform="translate(50 104.188)"
      />

      {/* Right arm */}
      <path
        d="M0 0 C6.4 0 10.47 3.93 15 8 C19.67 12.68 23.11 17.63 23.38 24.38 C23.03 32.4 20.04 37.96 14.54 43.77 C4.94 52.21 -10.08 59.27 -22.96 60.22 C-26 59 -26 59 -26 54 C-18.29 50.03 13.26 45.44 14 21 C10.58 14.03 4.39 10.04 -2 6 Z"
        fill={color}
        transform="translate(174 104)"
      />
    </svg>
  )
}

const TrashIcon: React.FC<IconProps> = ({ size = "24px", color = "currentColor" }) => {
  const { width, height } = parseSize(size)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

const PlayIcon: React.FC<IconProps> = ({ size = "24px", color = "#4B4B4B" }) => {
  const { width, height } = parseSize(size)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  )
}

const MicIcon: React.FC<IconProps> = ({ size = "24px", color = "#4B4B4B" }) => {
  const { width, height } = parseSize(size)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  )
}

const CheckIcon: React.FC<IconProps> = ({ size = "20px", color = "currentColor" }) => {
  const { width, height } = parseSize(size)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export {
  CameraIcon,
  CheckIcon,
  CloseIcon,
  LoadingDot,
  LoadingSpinner,
  MenuIcon,
  MicIcon,
  NextIcon,
  PenIcon,
  PictureIcon,
  PlayIcon,
  PrevIcon,
  RecordIcon,
  StopIcon,
  SwitchCameraIcon,
  SyncIcon,
  TrashIcon,
}
