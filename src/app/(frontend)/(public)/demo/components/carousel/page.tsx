"use client"

import { Carousel } from "@/components/atoms/Carousel"
import { Modal } from "@/components/atoms/Modal"
import Image from "next/image"
import React, { useState } from "react"

const DEMO_IMAGES = [
  "https://images.unsplash.com/photo-1510915228340-29c85a43dcfe?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=1200&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1498050108023-c5249f4df085?q=80&w=1200&auto=format&fit=crop",
]

const DemoSection = ({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) => (
  <section className="space-y-4 border-b border-zinc-200 py-8">
    <div className="px-4">
      <h2 className="text-xl font-bold text-zinc-900">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
    </div>
    <div className="rounded-3xl bg-zinc-50 p-6">{children}</div>
  </section>
)

export default function CarouselDemoPage() {
  const [viewingIndex, setViewingIndex] = useState<number | null>(null)

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-4 py-12">
      <header className="px-4">
        <h1 className="text-4xl font-black tracking-tight text-zinc-900 uppercase">Carousel Demo</h1>
        <p className="mt-2 text-lg text-zinc-500">CSS View Timelines, Viewport Masks, and SVG Scaling integration.</p>
      </header>

      {/* 1. Interactive Snapshot Mode Variants */}
      <DemoSection
        title="Interactive Snap Scroll Variants"
        description="Compare default behavior (buttons hide at edges) vs always-visible buttons for circular navigation."
      >
        <div className="space-y-6">
          {/* Default behavior */}
          <div>
            <p className="mb-3 text-sm font-medium text-zinc-700">Default: Buttons hide at scroll edges</p>
            <Carousel gap="1rem" className="h-60">
              {DEMO_IMAGES.map((src, i) => (
                <Carousel.Item key={i} className="h-full w-[80%] md:w-[60%]">
                  <img src={src} alt="" className="h-full w-full rounded-2xl object-cover shadow-xl" />
                </Carousel.Item>
              ))}
            </Carousel>
          </div>

          {/* Always visible buttons */}
          <div>
            <p className="mb-3 text-sm font-medium text-zinc-700">
              Always Visible: Buttons stay visible for circular navigation
            </p>
            <Carousel gap="1rem" className="h-60" circularButtons={false}>
              {DEMO_IMAGES.map((src, i) => (
                <Carousel.Item key={i} className="h-full w-[80%] md:w-[60%]">
                  <img src={src} alt="" className="h-full w-full rounded-2xl object-cover shadow-xl" />
                </Carousel.Item>
              ))}
            </Carousel>
          </div>
        </div>
      </DemoSection>

      {/* 2. FitText Infinite Marquee */}
      <DemoSection
        title="Typography FitText (Marquee)"
        description="SVG-based FitText ensures typography matches the grid cell perfectly. No overflows, pure scaling."
      >
        <div className="space-y-4">
          <Carousel marquee marqueeSpeed={15} gap="2rem" columnWidth="max(20rem, 30cqi)">
            <Carousel.FitText className="text-blue-600">UNLIMITED</Carousel.FitText>
            <Carousel.FitText className="text-zinc-900">POTENTIAL</Carousel.FitText>
            <Carousel.FitText className="text-red-500">CREATIVE</Carousel.FitText>
            <Carousel.FitText className="text-zinc-900">INFINITY</Carousel.FitText>
          </Carousel>

          <Carousel marquee marqueeDirection="ltr" marqueeSpeed={25} gap="4rem" columnWidth="max(15rem, 25cqi)">
            <Carousel.FitText className="text-zinc-400">MODERN</Carousel.FitText>
            <Carousel.FitText className="text-zinc-400">INTERFACE</Carousel.FitText>
            <Carousel.FitText className="text-zinc-400">DESIGN</Carousel.FitText>
            <Carousel.FitText className="text-zinc-400">SYSTEM</Carousel.FitText>
          </Carousel>
        </div>
      </DemoSection>

      {/* 3. Smooth Image Marquee with Masks */}
      <DemoSection
        title="Visual Infinite Loop"
        description="Smooth continuous loop using CSS transitions. Edge masking prevents harsh cropping."
      >
        <Carousel marquee marqueeSpeed={40} gap="1rem" columnWidth="250px" fade={true}>
          {DEMO_IMAGES.map((src, i) => (
            <img key={i} src={src} alt="" className="aspect-square rounded-xl object-cover shadow-lg" />
          ))}
        </Carousel>
      </DemoSection>

      {/* 4. Single View (ImageViewer Style) */}
      <DemoSection
        title="Specific Index View"
        description="Forcing a specific index and disabling fade for focused viewing (ImageViewer style)."
      >
        <div className="relative">
          <Carousel index={2} className="h-75" fade={false}>
            {DEMO_IMAGES.map((src, i) => (
              <Carousel.Item key={i} className="h-full">
                <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-3xl bg-zinc-900 p-4">
                  <img src={src} alt="" className="max-h-full max-w-full object-contain" />
                  <div className="absolute top-4 left-6 font-mono text-xs text-white/50">INDEX: {i}</div>
                </div>
              </Carousel.Item>
            ))}
          </Carousel>
          <div className="mt-4 text-center font-mono text-xs text-zinc-400 italic">
            Configured with index=2, fade=false
          </div>
        </div>
      </DemoSection>

      {/* 5. Custom Styling & Grid Control */}
      <DemoSection
        title="Custom Grid & Transitions"
        description="Control grid alignment with containerClassName, adjust gaps with gap prop, and customize item styling for unique layouts."
      >
        <div className="space-y-4">
          {/* Default grid */}
          <div>
            <p className="mb-2 text-sm text-zinc-600">Default: items-start, gap=1rem</p>
            <Carousel gap="1rem" className="h-32">
              {DEMO_IMAGES.slice(0, 3).map((src, i) => (
                <Carousel.Item key={i} className="w-24">
                  <img src={src} alt="" className="h-full w-full rounded-lg object-cover" />
                </Carousel.Item>
              ))}
            </Carousel>
          </div>

          {/* Custom alignment and gap */}
          <div>
            <p className="mb-2 text-sm text-zinc-600">Custom: items-end, gap=0.75rem, hover effects</p>
            <Carousel containerClassName="items-end pb-4" gap="0.75rem" className="h-32">
              {DEMO_IMAGES.slice(0, 3).map((src, i) => (
                <Carousel.Item key={i} className="w-24">
                  <div className="group relative w-full overflow-hidden rounded-lg bg-zinc-200 shadow-sm">
                    <img
                      src={src}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                  </div>
                </Carousel.Item>
              ))}
            </Carousel>
          </div>
        </div>
      </DemoSection>

      {/* 6. Modal Integration (ImageViewer Style) */}
      <DemoSection
        title="Modal Integration (ImageViewer Style)"
        description="Modal component integration for full-screen image viewing, similar to camera gallery. Click thumbnails to open modal."
      >
        <div className="space-y-4">
          {/* Gallery Thumbnails */}
          <div className="grid grid-cols-5 gap-2">
            {DEMO_IMAGES.map((src, i) => (
              <button
                key={i}
                onClick={() => setViewingIndex(i)}
                className="aspect-square overflow-hidden rounded-lg bg-zinc-200 shadow-sm ring-1 ring-black/5 transition-all hover:scale-105 hover:shadow-md active:scale-95"
              >
                <img src={src} alt={`Thumbnail ${i}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </DemoSection>

      <footer className="border-t border-zinc-100 pt-20 pb-12 text-center">
        <p className="text-sm text-zinc-400">Built with React & Modern CSS Native Features.</p>
      </footer>

      {/* ImageViewer Modal */}
      <Modal isOpen={viewingIndex !== null} onClose={() => setViewingIndex(null)} className="h-[90vh] w-[90vw] p-0">
        {viewingIndex !== null && (
          <Carousel index={viewingIndex} className="h-full p-4" containerClassName="h-full" fade={false} gap="0">
            {DEMO_IMAGES.map((image, index) => (
              <Carousel.Item key={index} className="relative h-full w-full">
                <Image
                  src={image}
                  alt={`View ${index}`}
                  fill
                  unoptimized
                  className="object-contain drop-shadow-2xl"
                  priority={index === viewingIndex}
                />
              </Carousel.Item>
            ))}
          </Carousel>
        )}
      </Modal>
    </div>
  )
}
