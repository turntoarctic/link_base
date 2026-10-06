/** 品牌标（favicon 同款：primary 圆角方块 + L） */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 select-none items-center justify-center rounded-[22%] bg-(--primary) font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.52 }}
    >
      L
    </span>
  )
}
