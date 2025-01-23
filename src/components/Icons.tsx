const PrevIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    className="w-4 h-4 text-white"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M15 19l-7-7 7-7"
    ></path>
  </svg>
);

const NextIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    className="w-4 h-4 text-white"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M9 5l7 7-7 7"
    ></path>
  </svg>
);

const LinesIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor" // fill属性をcurrentColorに変更
    className={className}
    {...props} // 渡されたpropsをsvg要素に適用
  >
    <path d="M2.39 2.105c-.342.108-.585.267-.857.562a1.974 1.974 0 0 0-.328 2.203c.145.305.562.746.848.89.492.254-.01.24 9.947.24 8.128 0 9.248-.01 9.492-.07.994-.263 1.645-1.238 1.477-2.222-.113-.675-.61-1.317-1.205-1.561l-.272-.108-9.422-.01c-8.906-.009-9.436-.004-9.68.076zM8.658 10.031c-1.036.178-1.795 1.228-1.631 2.255.14.867.81 1.542 1.673 1.683.37.06 12.23.06 12.6 0a2.025 2.025 0 0 0 1.673-1.683c.17-1.05-.595-2.081-1.673-2.255-.337-.056-12.314-.051-12.642 0zM14.498 18.07c-.38.103-.618.244-.904.535a1.945 1.945 0 0 0-.042 2.747c.28.3.53.454.89.557.235.07.638.075 3.656.066l3.394-.014.272-.108c.375-.155.834-.586 1.017-.966a1.985 1.985 0 0 0-1.289-2.817c-.394-.103-6.614-.098-6.994 0z" />
  </svg>
);

export { PrevIcon, NextIcon, LinesIcon };
