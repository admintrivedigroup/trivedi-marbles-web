"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { LoaderCircle, Plus, Save, Settings2 } from "lucide-react";

import { compressImage } from "@/lib/cloudinary/compress";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";

import { saveLot } from "@/app/inventory/_actions/lot";
import {
  cleanupCloudinaryImages,
  saveSlabImages,
} from "@/app/inventory/_actions/slab-images";
import {
  initialSaveLotResult,
  type SaveLotResult,
} from "@/app/inventory/_actions/stock-state";
import {
  addLookupOption,
  deleteLookupOption,
  type LookupTableName,
} from "@/app/inventory/_actions/lookup-options";
import type { StockLookupOption } from "@/app/inventory/_lib/stock";
import { useLookupOptions } from "@/app/inventory/_components/lookup-options-context";
import {
  AddOptionDialog,
  ManageOptionsDialog,
  PriceInput,
} from "@/app/inventory/_components/add-stock-dialogs";
import {
  SlabGrid,
  type SlabRow,
  type SlabFieldKey,
} from "@/app/inventory/_components/add-stock-slab-grid";

type LotFormValues = {
  categoryId: string;
  costPrice: string;
  dealerPrice: string;
  invoiceNumber: string;
  lotNumber: string;
  marbleName: string;
  notes: string;
  purchaseDate: string;
  sellingPrice: string;
  statusId: string;
  supplierName: string;
  thicknessId: string;
  warehouseId: string;
};

type OptionModalState = {
  formField: keyof LotFormValues | null;
  isOpen: boolean;
  label: string;
  tableName: LookupTableName | null;
};

function buildSlabCode(lotNumber: string, index: number) {
  const prefix = lotNumber.trim();
  return prefix ? `${prefix}-S${index + 1}` : `S${index + 1}`;
}

function createSlabRow(lotNumber: string, index: number, idSuffix: number): SlabRow {
  return {
    id: `slab-${idSuffix}`,
    imageFile: null,
    imagePreviewUrl: null,
    length: "",
    notes: "",
    rackNumber: "",
    slabCode: buildSlabCode(lotNumber, index),
    slabCodeAuto: true,
    width: "",
  };
}

function createInitialLotForm({
  statusOptions,
  thicknessOptions,
  warehouseOptions,
}: {
  statusOptions: StockLookupOption[];
  thicknessOptions: StockLookupOption[];
  warehouseOptions: StockLookupOption[];
}): LotFormValues {
  return {
    categoryId: "",
    costPrice: "",
    dealerPrice: "",
    invoiceNumber: "",
    lotNumber: "",
    marbleName: "",
    notes: "",
    purchaseDate: "",
    sellingPrice: "",
    statusId: statusOptions[0]?.id ?? "",
    supplierName: "",
    thicknessId: thicknessOptions[0]?.id ?? "",
    warehouseId: warehouseOptions[0]?.id ?? "",
  };
}

function formatThicknessLabel(value: string) {
  return /^\d+(\.\d+)?$/.test(value) ? `${value}mm` : value;
}

export function AddStock() {
  const { options, addOption, removeOption } = useLookupOptions();

  const slabCounter = useRef(1);
  const slabsRef = useRef<SlabRow[]>([]);

  const [lotForm, setLotForm] = useState<LotFormValues>(() =>
    createInitialLotForm({
      statusOptions: options.statuses,
      thicknessOptions: options.thicknesses,
      warehouseOptions: options.warehouses,
    }),
  );

  const [slabs, setSlabs] = useState<SlabRow[]>([
    createSlabRow("", 0, slabCounter.current++),
  ]);

  // Keep ref in sync so the unmount cleanup always sees latest slabs
  slabsRef.current = slabs;

  const [submissionState, setSubmissionState] = useState<SaveLotResult>(initialSaveLotResult);
  const [isPending, startTransition] = useTransition();

  const [addOptionModal, setAddOptionModal] = useState<OptionModalState>({
    formField: null,
    isOpen: false,
    label: "",
    tableName: null,
  });

  const [manageModal, setManageModal] = useState<OptionModalState>({
    formField: null,
    isOpen: false,
    label: "",
    tableName: null,
  });

  // Revoke all object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      slabsRef.current.forEach((slab) => {
        if (slab.imagePreviewUrl) URL.revokeObjectURL(slab.imagePreviewUrl);
      });
    };
  }, []);

  const hasRequiredOptions =
    options.categories.length > 0 &&
    options.warehouses.length > 0 &&
    options.statuses.length > 0 &&
    options.thicknesses.length > 0;

  function clearFormFields() {
    slabs.forEach((slab) => {
      if (slab.imagePreviewUrl) URL.revokeObjectURL(slab.imagePreviewUrl);
    });
    setLotForm(
      createInitialLotForm({
        statusOptions: options.statuses,
        thicknessOptions: options.thicknesses,
        warehouseOptions: options.warehouses,
      }),
    );
    setSlabs([createSlabRow("", 0, slabCounter.current++)]);
  }

  function resetForm() {
    clearFormFields();
    setSubmissionState(initialSaveLotResult);
  }

  function handleLotFieldChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    if (name === "lotNumber") {
      setLotForm((prev) => ({ ...prev, lotNumber: value }));
      setSlabs((prev) =>
        prev.map((slab, i) =>
          slab.slabCodeAuto ? { ...slab, slabCode: buildSlabCode(value, i) } : slab,
        ),
      );
    } else {
      setLotForm((prev) => ({ ...prev, [name]: value }));
    }

    if (submissionState.status !== "idle") {
      setSubmissionState(initialSaveLotResult);
    }
  }

  function addSlab() {
    setSlabs((prev) => {
      const index = prev.length;
      return [...prev, createSlabRow(lotForm.lotNumber, index, slabCounter.current++)];
    });
  }

  function removeSlab(slabId: string) {
    setSlabs((prev) => {
      const target = prev.find((s) => s.id === slabId);
      if (target?.imagePreviewUrl) URL.revokeObjectURL(target.imagePreviewUrl);
      const filtered = prev.filter((s) => s.id !== slabId);
      return filtered.map((slab, i) =>
        slab.slabCodeAuto ? { ...slab, slabCode: buildSlabCode(lotForm.lotNumber, i) } : slab,
      );
    });
  }

  function handleSlabFieldChange(slabId: string, field: SlabFieldKey, value: string) {
    setSlabs((prev) =>
      prev.map((slab) => {
        if (slab.id !== slabId) return slab;
        if (field === "slabCode") return { ...slab, slabCode: value, slabCodeAuto: false };
        return { ...slab, [field]: value };
      }),
    );

    if (submissionState.status !== "idle") {
      setSubmissionState(initialSaveLotResult);
    }
  }

  async function handleSlabImageChange(slabId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    const compressed = await compressImage(file);
    setSlabs((prev) =>
      prev.map((slab) => {
        if (slab.id !== slabId) return slab;
        if (slab.imagePreviewUrl) URL.revokeObjectURL(slab.imagePreviewUrl);
        return {
          ...slab,
          imageFile: compressed,
          imagePreviewUrl: URL.createObjectURL(compressed),
        };
      }),
    );
  }

  function removeSlabImage(slabId: string) {
    setSlabs((prev) =>
      prev.map((slab) => {
        if (slab.id !== slabId) return slab;
        if (slab.imagePreviewUrl) URL.revokeObjectURL(slab.imagePreviewUrl);
        return { ...slab, imageFile: null, imagePreviewUrl: null };
      }),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData();
    for (const [key, value] of Object.entries(lotForm)) {
      formData.set(key, value);
    }
    formData.set(
      "slabsJson",
      JSON.stringify(
        slabs.map((s) => ({
          slabCode: s.slabCode,
          length: s.length,
          width: s.width,
          rackNumber: s.rackNumber,
          notes: s.notes,
        })),
      ),
    );

    setSubmissionState(initialSaveLotResult);

    startTransition(async () => {
      // Declared outside try-catch so the catch block can clean up any images
      // already delivered to Cloudinary if an unexpected error aborts the save.
      const uploaded: Array<{
        slabId: string;
        imageUrl: string;
        publicId: string;
        sortOrder: number;
      }> = [];

      try {
        const result = await saveLot(formData);

        if (result.status === "success") {
          const pendingUploads = slabs
            .map((slab, i) => ({
              file: slab.imageFile,
              slabId: result.slabIds[i] ?? null,
              sortOrder: i,
            }))
            .filter(
              (item): item is { file: File; slabId: string; sortOrder: number } =>
                item.file !== null && item.slabId !== null,
            );

          if (pendingUploads.length > 0) {
            setSubmissionState({
              ...result,
              message: `Uploading ${pendingUploads.length} photo${pendingUploads.length === 1 ? "" : "s"}...`,
            });

            let uploadFailed = 0;
            let firstUploadError: string | null = null;

            for (const item of pendingUploads) {
              try {
                const { secureUrl, publicId } = await uploadToCloudinary(item.file);
                uploaded.push({
                  slabId: item.slabId,
                  imageUrl: secureUrl,
                  publicId,
                  sortOrder: item.sortOrder,
                });
              } catch (err) {
                uploadFailed++;
                if (!firstUploadError) {
                  firstUploadError = err instanceof Error ? err.message : "Upload failed.";
                }
              }
            }

            if (uploaded.length > 0) {
              const saveResult = await saveSlabImages(uploaded);
              if (saveResult.error) {
                cleanupCloudinaryImages(uploaded.map((u) => u.publicId)).catch(() => {});
                clearFormFields();
                setSubmissionState({
                  ...result,
                  message: `Lot saved, but photos could not be recorded. ${saveResult.error}`,
                  status: "error",
                });
                return;
              }
            }

            const photoMsg =
              uploadFailed > 0
                ? `${uploaded.length} photo${uploaded.length === 1 ? "" : "s"} saved, ${uploadFailed} failed to upload.${firstUploadError ? ` Error: ${firstUploadError}` : ""}`
                : `${uploaded.length} photo${uploaded.length === 1 ? "" : "s"} uploaded.`;

            clearFormFields();
            setSubmissionState({
              ...result,
              message: `${result.message} ${photoMsg}`,
            });
          } else {
            clearFormFields();
            setSubmissionState(result);
          }
        } else {
          setSubmissionState(result);
        }
      } catch {
        if (uploaded.length > 0) {
          cleanupCloudinaryImages(uploaded.map((u) => u.publicId)).catch(() => {});
        }
        setSubmissionState({
          lotId: null,
          message: "Unable to save lot right now. Please try again.",
          slabCount: 0,
          slabIds: [],
          status: "error",
        });
      }
    });
  }

  function openAddModal(tableName: LookupTableName, label: string, formField: keyof LotFormValues) {
    setAddOptionModal({ formField, isOpen: true, label, tableName });
  }

  function closeAddModal() {
    setAddOptionModal({ formField: null, isOpen: false, label: "", tableName: null });
  }

  function openManageModal(tableName: LookupTableName, label: string, formField: keyof LotFormValues) {
    setManageModal({ formField, isOpen: true, label, tableName });
  }

  function closeManageModal() {
    setManageModal({ formField: null, isOpen: false, label: "", tableName: null });
  }

  async function handleDeleteOption(id: string): Promise<string | null> {
    if (!manageModal.tableName || !manageModal.formField) return null;
    const { error } = await deleteLookupOption(manageModal.tableName, id);
    if (error) return error;
    removeOption(manageModal.tableName, id);
    setLotForm((prev) => {
      if (prev[manageModal.formField!] !== id) return prev;
      return { ...prev, [manageModal.formField!]: "" };
    });
    return null;
  }

  function getOptionsForManageModal() {
    switch (manageModal.tableName) {
      case "marble_categories": return options.categories;
      case "slab_statuses": return options.statuses;
      case "thickness_options": return options.thicknesses;
      case "warehouses": return options.warehouses;
      default: return [];
    }
  }

  async function handleAddOption(name: string): Promise<string | null> {
    if (!addOptionModal.tableName || !addOptionModal.formField) return null;
    const result = await addLookupOption(addOptionModal.tableName, name);
    if (result.error || !result.option) return result.error ?? "Failed to save option.";
    addOption(addOptionModal.tableName, result.option);
    setLotForm((prev) => ({ ...prev, [addOptionModal.formField!]: result.option!.id }));
    closeAddModal();
    return null;
  }

  function AddButton({
    tableName,
    label,
    formField,
  }: {
    tableName: LookupTableName;
    label: string;
    formField: keyof LotFormValues;
  }) {
    return (
      <button
        type="button"
        title={`Add new ${label.toLowerCase()}`}
        onClick={() => openAddModal(tableName, label, formField)}
        disabled={isPending}
        className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        <Plus className="h-3 w-3" strokeWidth={3} />
      </button>
    );
  }

  function ManageButton({
    tableName,
    label,
    formField,
  }: {
    tableName: LookupTableName;
    label: string;
    formField: keyof LotFormValues;
  }) {
    return (
      <button
        type="button"
        title={`Manage ${label.toLowerCase()} options`}
        onClick={() => openManageModal(tableName, label, formField)}
        disabled={isPending}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 text-gray-500 transition-colors hover:border-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Settings2 className="h-3 w-3" />
      </button>
    );
  }

  return (
    <>
      {addOptionModal.isOpen && addOptionModal.tableName ? (
        <AddOptionDialog
          label={addOptionModal.label}
          onClose={closeAddModal}
          onSave={handleAddOption}
        />
      ) : null}

      {manageModal.isOpen && manageModal.tableName ? (
        <ManageOptionsDialog
          label={manageModal.label}
          options={getOptionsForManageModal()}
          onClose={closeManageModal}
          onDelete={handleDeleteOption}
        />
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 md:text-3xl">Add New Lot</h2>
          <p className="mt-1 text-gray-500">Enter lot details and slabs below</p>
        </div>

        {!hasRequiredOptions ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Active categories, warehouses, statuses, and thickness options must exist in
            Supabase before a lot can be saved.
          </div>
        ) : null}

        {submissionState.message ? (
          <div
            className={
              submissionState.status === "success"
                ? "rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
                : "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            }
          >
            {submissionState.message}
          </div>
        ) : null}

        {/* Lot Details */}
        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">Lot Details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lotNumber" className="text-sm font-medium text-gray-700">
                Lot Number
              </label>
              <input
                id="lotNumber"
                name="lotNumber"
                type="text"
                value={lotForm.lotNumber}
                onChange={handleLotFieldChange}
                placeholder="LOT001"
                disabled={isPending}
                className="rounded-xl border border-gray-200 px-4 py-3 font-mono focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="marbleName" className="text-sm font-medium text-gray-700">
                Marble Name
              </label>
              <input
                id="marbleName"
                name="marbleName"
                type="text"
                value={lotForm.marbleName}
                onChange={handleLotFieldChange}
                placeholder="Ambaji White Grey"
                disabled={isPending}
                className="rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="categoryId" className="text-sm font-medium text-gray-700">Category</label>
                <div className="flex items-center gap-1.5">
                  <ManageButton tableName="marble_categories" label="Category" formField="categoryId" />
                  <AddButton tableName="marble_categories" label="Category" formField="categoryId" />
                </div>
              </div>
              <select
                id="categoryId"
                name="categoryId"
                value={lotForm.categoryId}
                onChange={handleLotFieldChange}
                disabled={isPending || options.categories.length === 0}
                className="appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">
                  {options.categories.length > 0 ? "Select Category" : "No categories available"}
                </option>
                {options.categories.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="statusId" className="text-sm font-medium text-gray-700">Status</label>
                <div className="flex items-center gap-1.5">
                  <ManageButton tableName="slab_statuses" label="Status" formField="statusId" />
                  <AddButton tableName="slab_statuses" label="Status" formField="statusId" />
                </div>
              </div>
              <select
                id="statusId"
                name="statusId"
                value={lotForm.statusId}
                onChange={handleLotFieldChange}
                disabled={isPending || options.statuses.length === 0}
                className="appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              >
                {options.statuses.length === 0 ? (
                  <option value="">No statuses available</option>
                ) : (
                  options.statuses.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))
                )}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="thicknessId" className="text-sm font-medium text-gray-700">Thickness (mm)</label>
                <div className="flex items-center gap-1.5">
                  <ManageButton tableName="thickness_options" label="Thickness" formField="thicknessId" />
                  <AddButton tableName="thickness_options" label="Thickness" formField="thicknessId" />
                </div>
              </div>
              <select
                id="thicknessId"
                name="thicknessId"
                value={lotForm.thicknessId}
                onChange={handleLotFieldChange}
                disabled={isPending || options.thicknesses.length === 0}
                className="appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              >
                {options.thicknesses.length === 0 ? (
                  <option value="">No thickness options available</option>
                ) : (
                  options.thicknesses.map((option) => (
                    <option key={option.id} value={option.id}>
                      {formatThicknessLabel(option.name)}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="warehouseId" className="text-sm font-medium text-gray-700">Warehouse</label>
                <div className="flex items-center gap-1.5">
                  <ManageButton tableName="warehouses" label="Warehouse" formField="warehouseId" />
                  <AddButton tableName="warehouses" label="Warehouse" formField="warehouseId" />
                </div>
              </div>
              <select
                id="warehouseId"
                name="warehouseId"
                value={lotForm.warehouseId}
                onChange={handleLotFieldChange}
                disabled={isPending || options.warehouses.length === 0}
                className="appearance-none rounded-xl border border-gray-200 bg-white px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              >
                {options.warehouses.length === 0 ? (
                  <option value="">No warehouses available</option>
                ) : (
                  options.warehouses.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))
                )}
              </select>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">
            Pricing (per sqft <span className="font-light text-gray-400">(estimate)</span>)
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <PriceInput
              id="costPrice"
              label="Cost Price"
              name="costPrice"
              value={lotForm.costPrice}
              onChange={handleLotFieldChange}
              disabled={isPending}
            />
            <PriceInput
              id="sellingPrice"
              label="Sell Price"
              name="sellingPrice"
              value={lotForm.sellingPrice}
              onChange={handleLotFieldChange}
              disabled={isPending}
            />
            <PriceInput
              id="dealerPrice"
              label="Dealer Price"
              name="dealerPrice"
              value={lotForm.dealerPrice}
              onChange={handleLotFieldChange}
              disabled={isPending}
            />
          </div>
        </section>

        {/* Slabs */}
        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900 md:text-lg">
              Slabs
              <span className="ml-2 text-sm font-normal text-gray-500">({slabs.length})</span>
            </h3>
            <button
              type="button"
              onClick={addSlab}
              disabled={isPending}
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              Add Slab
            </button>
          </div>
          <SlabGrid
            slabs={slabs}
            isPending={isPending}
            onFieldChange={handleSlabFieldChange}
            onImageChange={handleSlabImageChange}
            onRemoveSlab={removeSlab}
            onRemoveImage={removeSlabImage}
          />
        </section>

        {/* Lot Notes */}
        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-6">
          <h3 className="mb-4 text-base font-bold text-gray-900 md:text-lg">Lot Notes</h3>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            value={lotForm.notes}
            onChange={handleLotFieldChange}
            placeholder="Any additional information about this lot..."
            disabled={isPending}
            className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
          />
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending || !hasRequiredOptions}
            className="flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-3 font-medium text-white transition-all hover:scale-[1.02] hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-400 disabled:hover:scale-100 disabled:hover:shadow-none"
          >
            {isPending ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Lot
              </>
            )}
          </button>
          <button
            type="button"
            onClick={resetForm}
            disabled={isPending}
            className="rounded-xl border border-gray-200 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
