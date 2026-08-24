import { formatRupiah } from "@/lib/format";

export function PriceTape() {
  const marketLow = 48_000,
    recommended = 62_000,
    marketHigh = 78_000,
    viableFloor = 44_000;
  const min = Math.min(viableFloor, marketLow),
    max = Math.max(marketHigh, recommended);
  const position = (value: number) => 7 + ((value - min) / (max - min)) * 86;
  const marketStart = position(marketLow),
    marketWidth = position(marketHigh) - marketStart;
  return (
    <figure className="w-full max-w-xl">
      <figcaption className="sr-only">Contoh pita harga LAPAKIN</figcaption>
      <div aria-hidden="true">
        <p className="text-sm font-semibold tracking-[.08em] text-ink">
          CONTOH RENTANG HARGA
        </p>
        <p className="font-mono text-[clamp(2.75rem,6vw,5.25rem)] leading-none tracking-[-.07em] text-ink">
          {formatRupiah(recommended)}
        </p>
        <p className="mt-3 text-sm font-semibold tracking-[.08em] text-ink">
          REKOMENDASI
        </p>
        <div className="mt-10">
          <div className="flex justify-between font-mono text-xs text-ink-muted">
            <span>{formatRupiah(marketLow)}</span>
            <span>{formatRupiah(marketHigh)}</span>
          </div>
          <div className="relative mt-3 h-16">
            <div className="absolute inset-x-0 top-7 h-3 bg-ink/10" />
            <div
              className="absolute top-7 h-3 bg-brand/35"
              style={{ left: `${marketStart}%`, width: `${marketWidth}%` }}
            />
            <span
              className="absolute top-3 h-11 w-1 -translate-x-1/2 bg-amber"
              style={{ left: `${position(viableFloor)}%` }}
            />
            <span
              className="absolute top-0 h-14 w-1 -translate-x-1/2 bg-ink"
              style={{ left: `${position(recommended)}%` }}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-4 text-sm">
          <span className="size-2 bg-amber" />
          <span className="text-ink-muted">Batas biaya layak</span>
          <span className="font-semibold text-ink">
            {formatRupiah(viableFloor)}
          </span>
        </div>
      </div>
      <div className="sr-only">
        <p>
          Contoh rentang harga. Rentang pasar berada di antara{" "}
          {formatRupiah(marketLow)} dan {formatRupiah(marketHigh)}. Batas harga
          layak adalah {formatRupiah(viableFloor)}. Rekomendasi harga adalah{" "}
          {formatRupiah(recommended)}.
        </p>
        <table>
          <caption>Contoh data pita harga</caption>
          <thead>
            <tr>
              <th scope="col">Titik harga</th>
              <th scope="col">Nilai</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Batas biaya layak</th>
              <td>{formatRupiah(viableFloor)}</td>
            </tr>
            <tr>
              <th scope="row">Rentang pasar</th>
              <td>
                {formatRupiah(marketLow)} hingga {formatRupiah(marketHigh)}
              </td>
            </tr>
            <tr>
              <th scope="row">Rekomendasi</th>
              <td>{formatRupiah(recommended)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </figure>
  );
}
