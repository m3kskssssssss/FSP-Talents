import Image from "next/image";

/**
 * Horizontal FSP logo. The brand book ships it twice: dark lettering for light
 * backgrounds (logo_02w) and light lettering for dark ones (logo_01). Both are
 * rendered and CSS shows the one that matches the theme, so there is no flash.
 * The wrapper has no display of its own: pass it in `className` (e.g. "flex").
 */
export function Logo({ width, className, priority }: { width: number; className?: string; priority?: boolean }) {
  const height = Math.round((width * 116) / 345);
  return (
    <span className={className}>
      <Image src="/brand/logo_02w.svg" alt="" width={width} height={height} priority={priority} className="dark:hidden" />
      <Image src="/brand/logo_01.svg" alt="" width={width} height={height} priority={priority} className="hidden dark:block" />
    </span>
  );
}
