"use client"

import React from "react"
import RadikoClient from "./client"
import { Station } from "./constants"

interface StationListProps {
  stations: Station[]
  selectedStation: string
}

export const StationList: React.FC<StationListProps> = ({ stations, selectedStation }) => {
  return (
    <div className="grid grid-cols-3 gap-1 text-sm sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {stations.map((station) => (
        <button
          key={station.id}
          onClick={() => {
            RadikoClient.selectStation(station.id)
          }}
          className={`flex flex-col items-center justify-center rounded p-1.5 transition-all ${
            selectedStation === station.id ? "bg-blue-500 text-white shadow-md" : "border bg-white hover:bg-gray-50"
          }`}
        >
          {station.banner && (
            <div className="relative mb-1 h-10 w-full">
              <img
                src={station.banner}
                alt={station.name}
                className={`h-full w-full object-contain ${selectedStation !== station.id ? "opacity-70 grayscale" : ""}`}
              />
            </div>
          )}
          <div className="w-full truncate text-center text-[10px] leading-tight">{station.name}</div>
        </button>
      ))}
    </div>
  )
}
