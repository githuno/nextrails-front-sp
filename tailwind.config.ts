import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
}

export default config

// // 動的に生成されるクラス名は、ビルド時に検出されない可能性があります。
// // この問題を解決するには、必要な背景色クラスをsafelistとして明示的に含める必要があります。
// safelist: ["bg-blue-500", "bg-green-500", "bg-red-500"],
// theme: {
//   extend: {
//     // https://coliss.com/articles/build-websites/operation/css/css-stretch-keyword.html
//     width: { stretch: "stretch" },
//     backgroundImage: {
//       "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
//       "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
//     },
//     // 効いてない
//     // keyframes: {
//     //   'slide-in-right': {
//     //     '0%': {
//     //       transform: 'translateX(100%)',
//     //       opacity: '0'
//     //     },
//     //     '100%': {
//     //       transform: 'translateX(0)',
//     //       opacity: '1'
//     //     }
//     //   },
//     //   'slide-in-left': {
//     //     '0%': {
//     //       transform: 'translateX(-100%)',
//     //       opacity: '0'
//     //     },
//     //     '100%': {
//     //       transform: 'translateX(0)',
//     //       opacity: '1'
//     //     }
//     //   },
//     //   'slide-in-up': {
//     //     '0%': {
//     //       transform: 'translateY(100%)',
//     //       opacity: '0'
//     //     },
//     //     '100%': {
//     //       transform: 'translateY(0)',
//     //       opacity: '1'
//     //     }
//     //   },
//     //   'slide-in-down': {
//     //     '0%': {
//     //       transform: 'translateY(-100%)',
//     //       opacity: '0'
//     //     },
//     //     '100%': {
//     //       transform: 'translateY(0)',
//     //       opacity: '1'
//     //     }
//     //   }
//     // },
//     // animation: {
//     //   'slide-in-right': 'slide-in-right 0.3s ease-out forwards',
//     //   'slide-in-left': 'slide-in-left 0.3s ease-out forwards',
//     //   'slide-in-up': 'slide-in-up 0.3s ease-out forwards',
//     //   'slide-in-down': 'slide-in-down 0.3s ease-out forwards'
//     // }
//   },
// },
