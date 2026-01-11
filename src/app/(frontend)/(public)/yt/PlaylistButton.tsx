import React from "react"

interface PlaylistButtonProps {
  onClick: () => void
}

const PlaylistButton: React.FC<PlaylistButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="fixed right-4 bottom-4 z-30 rounded-full bg-purple-500 p-3 text-white shadow-lg hover:bg-purple-600"
      aria-label="プレイリスト"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  )
}

export default PlaylistButton
