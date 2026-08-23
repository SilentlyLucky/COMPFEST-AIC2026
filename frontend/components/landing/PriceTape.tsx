import { formatRupiah } from "@/lib/format";

export function PriceTape() {
  const marketLow = 48_000;
  const recommended = 62_000;
  const marketHigh = 78_000;
  const viableFloor = 44_000;

  return (
    <figure className="price-tape" aria-labelledby="price-tape-title">
      <figcaption id="price-tape-title" className="mb-4 text-sm font-medium text-ink-muted">
        Contoh ilustrasi, bukan harga real-time
      </figcaption>
      <div className="flex items-end justify-between gap-4 font-mono text-xs text-ink-muted">
        <span>{formatRupiah(marketLow)}</span>
        <span>{formatRupiah(marketHigh)}</span>
      </div>
      <div className="relative mt-4 h-12" aria-hidden="true">
        <div className="absolute inset-x-0 top-5 h-3 rounded-full bg-ink/10" />
        <div className="absolute left-[14%] right-[12%] top-5 h-3 rounded-full bg-brand/24" />
        <span className="absolute left-[10%] top-1 h-11 w-1 rounded-full bg-status-warning" />
        <span className="absolute left-[58%] top-0 h-12 w-1 rounded-full bg-brand" />
      </div>
      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <p className="text-ink-muted">Batas harga layak</p>
          <p className="mt-1 font-semibold text-ink">{formatRupiah(viableFloor)}</p>
        </div>
        <div>
          <p className="text-ink-muted">Rekomendasi</p>
          <p className="mt-1 font-semibold text-brand">{formatRupiah(recommended)}</p>
        </div>
      </div>
    </figure>
  );
}
