import { CaptureImageButton } from "./CaptureImageButton";
import { CaptureVideoButton } from "./CaptureVideoButton";
import { SelectImageButton } from "./SelectImageButton";
import { MenuButton } from "./MenuButton";

const Controller = () => {
  return (
    <div className="flex h-6 items-center justify-center gap-2 rounded-lg shadow-lg bg-white/20">
      <CaptureVideoButton onSaveCompleted={() => {}} />
      <CaptureImageButton onSaved={() => {}} />
      <SelectImageButton onSaved={() => {}} />
      <MenuButton />
    </div>
  );
};

export { Controller };
