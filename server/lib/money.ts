const fmt = new Intl.NumberFormat("ru-RU");
export const formatMoney = (n: number) => `${fmt.format(n)} ₽`;
