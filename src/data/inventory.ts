export type InventoryLocation = "Ahmedabad" | "Ambaji";
export type InventoryStatus = "Available" | "Reserved" | "Sold";

export type InventorySlab = {
  category: string;
  id: string;
  images: string[];
  length: number;
  location: InventoryLocation;
  name: string;
  rack: string;
  sellPrice: number;
  slabId: string;
  sqft: number;
  status: InventoryStatus;
  thickness: number;
  width: number;
};

export type InventoryActivity = {
  id: string;
  text: string;
  time: string;
};

export type InventoryAlert = {
  id: string;
  severity: "low" | "medium";
  text: string;
};

export const slabs: InventorySlab[] = [];

export const activities: InventoryActivity[] = [];

export const alerts: InventoryAlert[] = [];
