export function formatValue(value: number, format?: string): string {
  switch (format) {
    case "currency":
      return value >= 1000
        ? `$${(value / 1000).toFixed(value >= 100000 ? 0 : 1)}k`
        : `$${value}`;
    case "percent":
      return `${value}%`;
    default:
      return value.toLocaleString();
  }
}
