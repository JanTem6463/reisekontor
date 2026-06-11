const formatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatEur(cent: number): string {
  return formatter.format(cent / 100).replace(/[  ]/g, " ");
}
