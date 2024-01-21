"use client"

import React, { useContext, createContext, useState, useCallback } from "react"
import * as Toast from "@radix-ui/react-toast"
import Image from "next/image"

import { tv } from "tailwind-variants"
import { twMerge } from "tailwind-merge"

type AppToastProps = {
  title: string
  description?: string
  variant?: "success" | "warning" | "error"
  timeout?: number
}

interface ToastContextData {
  showToast: (props: AppToastProps) => void
}

interface AppToastProviderProps {
  children: React.ReactNode
}

const ToastContext = createContext<ToastContextData>({} as ToastContextData)

const toast = tv({
  slots: {
    container: "absolute flex w-full items-center justify-center py-4",
    description: "",
    button: "mr-4 flex h-7 w-7 flex-grow-0 items-center justify-center rounded-full bg-white",
    icon: "",
  },
  variants: {
    variant: {
      success: {
        container: "bg-green-500",
        description: "",
        icon: "text-green-500",
      },
      error: {
        container: "bg-red-500",
        description: "text-white",
        icon: "text-red-500",
      },
      warning: {
        container: "bg-yellow-500",
        description: "text-black",
        icon: "text-yellow-500",
      },
    },
  },
  defaultVariants: {
    variant: "success",
  },
})

const AppToastProvider: React.FC<AppToastProviderProps> = ({ children }) => {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<AppToastProps | null>(null)

  const showToast = useCallback((props: AppToastProps) => {
    setOpen(true)
    setData(props)
  }, [])

  const { container, description, button, icon } = toast({
    variant: data?.variant,
  })

  return (
    <Toast.Provider swipeDirection="up">
      <ToastContext.Provider
        value={{
          showToast,
        }}
      >
        <Toast.Root
          className={twMerge(
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
            container(),
          )}
          open={open}
          onOpenChange={setOpen}
          duration={data?.timeout || 3000}
        >
          <div className="flex-1 text-center">
            <Toast.Title className={twMerge("font-semibold", description())}>{data?.title}</Toast.Title>
            {data?.description && <Toast.Description className={description()}>{data?.description}</Toast.Description>}
          </div>
          <Toast.Close className={button()}>
            <Image src="/material-icons/clear.svg" width={18} height={18} alt="clear" className={icon()} />
          </Toast.Close>
        </Toast.Root>
        <Toast.Viewport />

        {children}
      </ToastContext.Provider>
    </Toast.Provider>
  )
}

const useToast = (): ToastContextData => {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error("Must be inside a AppToastProvider")
  }

  return context
}

export { AppToastProvider, useToast }
