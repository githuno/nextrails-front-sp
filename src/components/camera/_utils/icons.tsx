import React from "react";

interface IconProps {
  size?: string;
  color?: string;
}

const LoadingSpinner: React.FC<IconProps> = ({ size = "36px", color = "#09f" }) => {
  return (
    <div className="spinner" style={{ width: size, height: size }}>
      <style jsx>{`
        .spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          border-radius: 50%;
          border-left-color: ${color};
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

const CloseIcon: React.FC<IconProps> = ({ size = "24px", color = "#000000" }) => {
  return (
    <svg
      className="hover:w-7 hover:h-7 transition-transform"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: size, height: size }}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5.29289 5.29289C5.68342 4.90237 6.31658 4.90237 6.70711 5.29289L12 10.5858L17.2929 5.29289C17.6834 4.90237 18.3166 4.90237 18.7071 5.29289C19.0976 5.68342 19.0976 6.31658 18.7071 6.70711L13.4142 12L18.7071 17.2929C19.0976 17.6834 19.0976 18.3166 18.7071 18.7071C18.3166 19.0976 17.6834 19.0976 17.2929 18.7071L12 13.4142L6.70711 18.7071C6.31658 19.0976 5.68342 19.0976 5.29289 18.7071C4.90237 18.3166 4.90237 17.6834 5.29289 17.2929L10.5858 12L5.29289 6.70711C4.90237 6.31658 4.90237 5.68342 5.29289 5.29289Z"
        fill={color}
      />
    </svg>
  );
};

const EditIcon: React.FC<IconProps> = ({ size = "16px", color = "#4B4B4B" }) => (
  <svg
    version="1.1"
    id="_x32_"
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    x="0px"
    y="0px"
    viewBox="0 0 512 512"
    style={{ width: size, height: size, opacity: 1 }}
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
);

const CameraIcon: React.FC<IconProps> = ({ size = "40px", color = "#4B4B4B" }) => (
  <svg
    version="1.1"
    id="_x32_"
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    x="0px"
    y="0px"
    width="512px"
    height="512px"
    viewBox="0 0 512 512"
    style={{ width: size, height: size, opacity: 1 }}
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
);

const RecordIcon: React.FC<IconProps> = ({ size = "40px", color = "#4B4B4B" }) => (
  <svg
    version="1.1"
    id="_x32_"
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    x="0px"
    y="0px"
    width="48px"
    height="48px"
    viewBox="0 0 512 512"
    style={{ width: size, height: size, opacity: 1 }}
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
);

const StopIcon: React.FC<IconProps> = ({ size = "32px", color = "#4B4B4B" }) => (
  <svg
    version="1.1"
    id="_x32_"
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    x="0px"
    y="0px"
    width="64px"
    height="64px"
    viewBox="0 0 512 512"
    style={{ width: size, height: size, opacity: 1 }}
    xmlSpace="preserve"
  >
    <style type="text/css">{`.st0{fill:${color};}`}</style>
    <path
      className="st0"
      d="M256,0C114.625,0,0,114.625,0,256s114.625,256,256,256s256-114.625,256-256S397.375,0,256,0z M328,328H184V184
      h144V328z"
      style={{ fill: color }}
    ></path>
  </svg>
);

const MenuIcon: React.FC<IconProps> = ({ size = "24px", color = "#4B4B4B" }) => (
  <svg
    version="1.1"
    id="_x32_"
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    x="0px"
    y="0px"
    viewBox="0 0 512 512"
    style={{ width: size, height: size, opacity: 1 }}
    xmlSpace="preserve"
  >
    <style type="text/css">{`.st0{fill:${color};}`}</style>
    <g>
      <circle
        className="st0"
        cx="48"
        cy="64"
        r="48"
        style={{ fill: color }}
      ></circle>
      <rect
        x="160"
        y="16"
        className="st0"
        width="352"
        height="96"
        style={{ fill: color }}
      ></rect>
      <circle
        className="st0"
        cx="48"
        cy="256"
        r="48"
        style={{ fill: color }}
      ></circle>
      <rect
        x="160"
        y="208"
        className="st0"
        width="352"
        height="96"
        style={{ fill: color }}
      ></rect>
      <circle
        className="st0"
        cx="48"
        cy="448"
        r="48"
        style={{ fill: color }}
      ></circle>
      <rect
        x="160"
        y="400"
        className="st0"
        width="352"
        height="96"
        style={{ fill: color }}
      ></rect>
    </g>
  </svg>
);


const PictureIcon: React.FC<IconProps> = ({ size = "32px", color = "#4B4B4B" }) => (
  <svg
    version="1.1"
    id="_x32_"
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    x="0px"
    y="0px"
    viewBox="0 0 512 512"
    style={{ width: size, height: size, opacity: 1 }}
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
);

const SyncIcon: React.FC<IconProps & {isSpinning?: boolean}> = ({ size = "32px", color = "#4B4B4B", isSpinning = true }) => (
  <svg
    version="1.1"
    id="_x32_"
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    x="0px"
    y="0px"
    viewBox="0 0 512 512"
    style={{ width: size, height: size, opacity: 1, animationDirection: "reverse" }}
    className={isSpinning ? "animate-spin" : ""}
    xmlSpace="preserve"
  >
    <style type="text/css">{`.st0{fill:${color};}`}</style>
    <g>
      <path
        className="st0"
        d="M219.147,181.496c16.249,0,189.803-21.675,241.023,70.898c-2.526-75.721-72.438-187.506-241.023-186.276V0
        L51.83,126.804l167.318,126.784V181.496z"
        style={{ fill: color }}
      />
      <path
        className="st0"
        d="M292.821,330.522c-16.226,0-189.812,21.62-240.991-70.906c2.499,75.73,72.425,187.47,240.991,186.265V512
        L460.17,385.187L292.821,258.402V330.522z"
        style={{ fill: color }}
      />
    </g>
  </svg>
);


export { LoadingSpinner, CloseIcon, EditIcon, CameraIcon, RecordIcon, StopIcon, MenuIcon, PictureIcon, SyncIcon };
