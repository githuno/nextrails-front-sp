import { CaptureImageButton } from "./CaptureImageButton";
import { CaptureVideoButton } from "./CaptureVideoButton";

const Controller = () => {
  return (
    <div className="flex items-center justify-center">
      <CaptureVideoButton onSaved={() => {}} />
      <CaptureImageButton onSaved={() => {}} />
    </div>
  );
};

export { Controller };
