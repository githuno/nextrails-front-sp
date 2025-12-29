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
    <div className="grid grid-cols-4 gap-1 text-sm md:grid-cols-5">
      {stations.map((station) => (
        <button
          key={station.id}
          onClick={() => {
            RadikoClient.selectStation(station.id)
          }}
          className={`rounded p-1 ${selectedStation === station.id ? "bg-blue-500 text-white shadow-md" : "border"}`}
        >
          {station.banner && (
            <div className="relative h-8 w-full">
              <img
                src={station.banner}
                alt={station.name}
                className={`object-contain ${selectedStation !== station.id ? "grayscale-80" : ""}`}
              />
            </div>
          )}
          <div className="truncate text-[0.5rem]">{station.name}</div>
        </button>
      ))}
    </div>
  )
}
