const formatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formatiert einen Cent-Wert als deutsches EUR-String ("16,80 €").
 * Eingabe in Cent (Integer), kein Float.
 */
export function formatEur(cent: number): string {
  // Intl.NumberFormat("de-DE", {currency: "EUR"}) liefert je nach Node-Version
  // NARROW NO-BREAK SPACE (U+202F) oder NO-BREAK SPACE (U+00A0) zwischen Zahl
  // und € — normalisiert hier auf normales Leerzeichen für stabile Ausgabe/Tests.
  return formatter.format(cent / 100).replace(/[  ]/g, " ");
}
