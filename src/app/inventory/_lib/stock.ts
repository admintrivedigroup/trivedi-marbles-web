export type StockLookupOption = {
  id: string;
  name: string;
};

export type LookupOptions = {
  categories: StockLookupOption[];
  statuses: StockLookupOption[];
  thicknesses: StockLookupOption[];
  warehouses: StockLookupOption[];
};
