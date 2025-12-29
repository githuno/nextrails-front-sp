import React from "react"

interface HistoryButtonProps {
  onClick: () => void
}

const HistoryButton: React.FC<HistoryButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="fixed right-4 bottom-20 z-30 rounded-full bg-blue-600 p-3 text-white shadow-lg hover:bg-blue-700"
      aria-label="視聴履歴"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </button>
  )
}

export default HistoryButton
