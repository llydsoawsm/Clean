/**
 * Money helpers — centavo-safe. All amounts integer centavos.
 * 1 PHP = 100 centavos. Display helpers only.
 */

export function toCentavos(pesos: number): number {
  return Math.round(pesos * 100);
}

export function fromCentavos(centavos: number): number {
  return centavos / 100;
}

export function formatPHP(centavos: number): string {
  const sign = centavos < 0 ? '-' : '';
  const abs = Math.abs(centavos);
  const pesos = Math.floor(abs / 100);
  const cents = abs % 100;
  return `${sign}₱${pesos.toLocaleString('en-PH')}.${cents.toString().padStart(2, '0')}`;
}

/**
 * Pricing:
 * - per_kg: weight_grams * price_per_kg / 1000
 * - per_load: ceil(weight_grams / weightBlockGrams) * price_per_load (e.g., 16000 per 8000g)
 * - per_piece: qty * price
 * - fixed: price
 */
export function calcBaseCost(params: {
  pricingType: 'per_kg' | 'per_piece' | 'fixed' | 'per_load';
  unitPriceCentavos: number;
  weightGrams?: number | null;
  quantity?: number | null;
  weightBlockGrams?: number | null;
}): number {
  const { pricingType, unitPriceCentavos, weightGrams, quantity, weightBlockGrams } = params;
  if (pricingType === 'per_kg') {
    if (!weightGrams || weightGrams <= 0) return 0;
    return Math.round((weightGrams * unitPriceCentavos) / 1000);
  }
  if (pricingType === 'per_load') {
    if (!weightGrams || weightGrams <= 0) return 0;
    const block = weightBlockGrams && weightBlockGrams > 0 ? weightBlockGrams : 8000;
    const loads = Math.ceil(weightGrams / block);
    return loads * unitPriceCentavos;
  }
  if (pricingType === 'per_piece') {
    if (!quantity || quantity <= 0) return 0;
    return quantity * unitPriceCentavos;
  }
  // fixed
  return unitPriceCentavos;
}

export function calcLoads(weightGrams: number, weightBlockGrams: number | null): number {
  const block = weightBlockGrams && weightBlockGrams > 0 ? weightBlockGrams : 8000;
  if (weightGrams <= 0) return 0;
  return Math.ceil(weightGrams / block);
}

export function calcTotal(base: number, additional: number, rush: number): number {
  return base + additional + rush;
}

export function calcBalance(total: number, paid: number): number {
  return total - paid;
}

export function derivePaymentStatus(total: number, paid: number): 'UNPAID' | 'PARTIAL' | 'PAID' {
  if (paid <= 0) return 'UNPAID';
  if (paid >= total) return 'PAID';
  return 'PARTIAL';
}

export function formatWeight(grams: number | null | undefined): string {
  if (grams == null || grams <= 0) return '-';
  const kg = grams / 1000;
  // Show 8 kg not 8.00 kg for integers, else 5.5 kg
  return Number.isInteger(kg) ? `${kg} kg` : `${kg.toFixed(2).replace(/\.?0+$/, '')} kg`;
  // Alternative cleaner: fixed 1 decimal if needed, but use above for consistency
}
