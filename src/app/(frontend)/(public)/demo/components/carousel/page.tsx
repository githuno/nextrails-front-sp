"use client"

import { Carousel } from "@/components/atoms/Carousel"
import React from "react"

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
  return (
    <div className="mx-auto max-w-5xl space-y-12 px-4 py-12">
      <header className="px-4">
        <h1 className="text-4xl font-black tracking-tight text-zinc-900 uppercase">Carousel Demo</h1>
        <p className="mt-2 text-lg text-zinc-500">CSS View Timelines, Viewport Masks, and SVG Scaling integration.</p>
      </header>

      {/* 1. Interactive Snapshot Mode (Default) */}
      <DemoSection
        title="Interactive Snap Scroll"
        description="Default interactive mode with view-timeline synced indicators and snap-mandatory behavior."
      >
        <Carousel gap="1rem" className="h-100">
          {DEMO_IMAGES.map((src, i) => (
            <Carousel.Item key={i} className="h-full w-[80%] md:w-[60%]">
              <img src={src} alt="" className="h-full w-full rounded-2xl object-cover shadow-xl" />
            </Carousel.Item>
          ))}
        </Carousel>
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
        description="Direct control over column widths and transition behavior via props."
      >
        <Carousel containerClassName="items-end pb-4" gap="0.75rem">
          {DEMO_IMAGES.map((src, i) => (
            <Carousel.Item key={i} className="w-32">
              <div className="group relative aspect-3/4 w-full overflow-hidden rounded-xl bg-zinc-200 shadow-xl ring-1 ring-black/5">
                <img
                  src={src}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </Carousel.Item>
          ))}
        </Carousel>
      </DemoSection>

      <footer className="border-t border-zinc-100 pt-20 pb-12 text-center">
        <p className="text-sm text-zinc-400">Built with React & Modern CSS Native Features.</p>
      </footer>
    </div>
  )
}
