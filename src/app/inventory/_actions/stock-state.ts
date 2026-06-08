export type SaveLotResult = {
  lotId: string | null;
  message: string | null;
  slabCount: number;
  slabIds: string[];
  status: "idle" | "success" | "error";
};

export const initialSaveLotResult: SaveLotResult = {
  lotId: null,
  message: null,
  slabCount: 0,
  slabIds: [],
  status: "idle",
};
