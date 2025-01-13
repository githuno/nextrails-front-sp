import { CaptureImageButton } from "./CaptureImageButton";
import { RecordVideoButton } from "./RecordVideoButton";
import { SelectImageButton } from "./SelectImageButton";
import { MenuButton } from "./MenuButton";

const Controller = () => {
  return (
    <div className="flex h-6 items-center gap-2 rounded-lg shadow-lg bg-white/20">
      <RecordVideoButton onSaveCompleted={() => {}} />
      <CaptureImageButton onSaved={() => {}} />
      <SelectImageButton onSaved={() => {}} />
      <MenuButton />
    </div>
  );
};

export { Controller };
