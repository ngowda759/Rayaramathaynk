import type { JSX } from "react";

import type { SlipSettings } from "@/types/seva";

function Photo({ src }: { src: string | null }): JSX.Element {
  // Header photos are stored URLs from Receipt settings (the same ones the slip prints); a plain <img> keeps them
  // exactly as configured, with no image-domain setup.
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt="" className="size-[52px] rounded-(--radius-control) object-cover" />;
  return <span aria-hidden="true" className="size-[52px] rounded-(--radius-control) border border-dashed border-(--border-strong) bg-(--muted)" />;
}

/**
 * The temple header band on the counter (Design Book 9, counter mockup `.tband`): photo left, the temple name in
 * English with Kannada under it and the address centred, photo right - the same header the slip prints.
 */
export function TempleHeaderBand({ slip }: { slip: SlipSettings }): JSX.Element {
  const address = [slip.addressLine1, slip.addressLine2].map((a) => a.trim()).filter((a) => a !== "");
  return (
    <header className="grid grid-cols-[52px_minmax(0,1fr)_52px] items-center gap-4 border-b border-(--border) bg-(--card) px-8 py-3 max-sm:px-4">
      <Photo src={slip.photoLeftUrl} />
      <div className="min-w-0 text-center">
        <div className="text-(length:--text-body) leading-snug font-semibold">{slip.templeNameEn}</div>
        <div className="kn primary text-(length:--text-ui)" lang="kn">
          {slip.templeNameKn}
        </div>
        {address.length > 0 ? <div className="meta">{address.join(", ")}</div> : null}
      </div>
      <Photo src={slip.photoRightUrl} />
    </header>
  );
}

export default TempleHeaderBand;
