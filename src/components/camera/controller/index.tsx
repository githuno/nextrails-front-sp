import { CaptureImageButton } from "./CaptureImageButton";
import { CaptureVideoButton } from "./CaptureVideoButton";
import { CameraState } from "../_utils";

interface ControllerProps {
  stream: MediaStream | null;
  state: CameraState;
  setState: React.Dispatch<React.SetStateAction<CameraState>>;
}

const Controller = ({ stream, state, setState }: ControllerProps) => {
  return (
    <div className="flex items-center justify-center">
      <CaptureVideoButton
        stream={stream}
        state={state}
        setState={setState}
        onSaved={() => {}}
      />
      <CaptureImageButton
        stream={stream}
        state={state}
        setState={setState}
        onSaved={() => {}}
      />
    </div>
  );
};

export { Controller };
