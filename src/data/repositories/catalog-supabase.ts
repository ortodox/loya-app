import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type {
  CatalogSettings,
  IntervalUnit,
  Localized,
  Preparation,
  ProcedureType,
  Zone,
  ZoneGroup,
} from "@/logic/catalog";
import type { Locale } from "@/config/locales";
import { DuplicateNameError, type CatalogRepository } from "./catalog";

type SettingsRow = {
  dose_text: string | null;
  dose_unit: string | null;
  course_min: number | null;
  course_max: number | null;
  interval_min: number | null;
  interval_max: number | null;
  interval_unit: IntervalUnit | null;
  maintenance_min: number | null;
  maintenance_max: number | null;
  maintenance_unit: IntervalUnit | null;
  maintenance_as_needed: boolean | null;
  control_after_days: number | null;
  advice: Localized | null;
  advice_review: Locale[] | null;
};

const settingsColumns =
  "dose_text, dose_unit, course_min, course_max, interval_min, interval_max, interval_unit, maintenance_min, maintenance_max, maintenance_unit, maintenance_as_needed, control_after_days, advice, advice_review";

function toSettings(r: SettingsRow): CatalogSettings {
  return {
    doseText: r.dose_text,
    doseUnit: r.dose_unit,
    courseMin: r.course_min,
    courseMax: r.course_max,
    intervalMin: r.interval_min,
    intervalMax: r.interval_max,
    intervalUnit: r.interval_unit,
    maintenanceMin: r.maintenance_min,
    maintenanceMax: r.maintenance_max,
    maintenanceUnit: r.maintenance_unit,
    maintenanceAsNeeded: r.maintenance_as_needed,
    controlAfterDays: r.control_after_days,
    advice: r.advice,
    adviceReview: r.advice_review,
  };
}

function settingsRow(s: CatalogSettings): SettingsRow {
  return {
    dose_text: s.doseText,
    dose_unit: s.doseUnit,
    course_min: s.courseMin,
    course_max: s.courseMax,
    interval_min: s.intervalMin,
    interval_max: s.intervalMax,
    interval_unit: s.intervalUnit,
    maintenance_min: s.maintenanceMin,
    maintenance_max: s.maintenanceMax,
    maintenance_unit: s.maintenanceUnit,
    maintenance_as_needed: s.maintenanceAsNeeded,
    control_after_days: s.controlAfterDays,
    advice: s.advice,
    advice_review: s.adviceReview,
  };
}

type TypeRow = SettingsRow & {
  id: string;
  code: string | null;
  name: Localized;
  sort_order: number;
  procedure_type_zones: { zone_id: string }[];
};
type PreparationRow = SettingsRow & {
  id: string;
  procedure_type_id: string;
  name: string;
  manufacturer: string | null;
  favorite: boolean;
};

const typeColumns = `id, code, name, sort_order, ${settingsColumns}, procedure_type_zones(zone_id)`;
const preparationColumns = `id, procedure_type_id, name, manufacturer, favorite, ${settingsColumns}`;

const toType = (r: TypeRow): ProcedureType => ({
  ...toSettings(r),
  id: r.id,
  code: r.code,
  name: r.name,
  sortOrder: r.sort_order,
  zoneIds: r.procedure_type_zones.map((z) => z.zone_id),
});

const toPreparation = (r: PreparationRow): Preparation => ({
  ...toSettings(r),
  id: r.id,
  procedureTypeId: r.procedure_type_id,
  name: r.name,
  manufacturer: r.manufacturer,
  favorite: r.favorite,
});

function check(error: PostgrestError | null) {
  if (!error) return;
  if (error.code === "23505") throw new DuplicateNameError(error.message);
  throw error;
}

/** Supabase-backed catalogue. RLS limits every query to the signed-in doctor (aal2). */
export function supabaseCatalogRepository(supabase: SupabaseClient): CatalogRepository {
  async function setZones(typeId: string, zoneIds: string[]) {
    const { data, error } = await supabase
      .from("procedure_type_zones")
      .select("zone_id")
      .eq("procedure_type_id", typeId);
    check(error);
    const current = new Set((data ?? []).map((r) => r.zone_id as string));
    const wanted = new Set(zoneIds);
    const removed = [...current].filter((id) => !wanted.has(id));
    const added = [...wanted].filter((id) => !current.has(id));
    if (removed.length > 0) {
      const res = await supabase
        .from("procedure_type_zones")
        .delete()
        .eq("procedure_type_id", typeId)
        .in("zone_id", removed);
      check(res.error);
    }
    if (added.length > 0) {
      const res = await supabase
        .from("procedure_type_zones")
        .insert(added.map((zone_id) => ({ procedure_type_id: typeId, zone_id })));
      check(res.error);
    }
  }

  return {
    async listZones() {
      const { data, error } = await supabase
        .from("zones")
        .select("id, code, name, zone_group, sort_order")
        .eq("active", true)
        .order("sort_order");
      check(error);
      return (data ?? []).map(
        (r): Zone => ({
          id: r.id,
          code: r.code,
          name: r.name,
          group: r.zone_group as ZoneGroup,
          sortOrder: r.sort_order,
        }),
      );
    },

    async listTypes() {
      const { data, error } = await supabase
        .from("procedure_types")
        .select(typeColumns)
        .eq("active", true)
        .order("sort_order")
        .order("created_at");
      check(error);
      return ((data ?? []) as TypeRow[]).map(toType);
    },

    async getType(id) {
      const { data, error } = await supabase.from("procedure_types").select(typeColumns).eq("id", id).maybeSingle();
      check(error);
      return data ? toType(data as TypeRow) : null;
    },

    async createType(input) {
      const { data, error } = await supabase
        .from("procedure_types")
        .insert({ name: input.name, ...settingsRow(input) })
        .select("id")
        .single();
      check(error);
      const id = data!.id as string;
      await setZones(id, input.zoneIds);
      return { id };
    },

    async updateType(id, input) {
      const { data, error } = await supabase
        .from("procedure_types")
        .update({ name: input.name, ...settingsRow(input) })
        .eq("id", id)
        .select("id");
      check(error);
      if (!data || data.length === 0) return false;
      await setZones(id, input.zoneIds);
      return true;
    },

    async listPreparations() {
      const { data, error } = await supabase
        .from("preparations")
        .select(preparationColumns)
        .eq("active", true)
        .order("name");
      check(error);
      return ((data ?? []) as PreparationRow[]).map(toPreparation);
    },

    async getPreparation(id) {
      const { data, error } = await supabase
        .from("preparations")
        .select(preparationColumns)
        .eq("id", id)
        .maybeSingle();
      check(error);
      return data ? toPreparation(data as PreparationRow) : null;
    },

    async createPreparation(input) {
      const { data, error } = await supabase
        .from("preparations")
        .insert({
          procedure_type_id: input.procedureTypeId,
          name: input.name,
          manufacturer: input.manufacturer,
          favorite: input.favorite,
          ...settingsRow(input),
        })
        .select("id")
        .single();
      check(error);
      return { id: data!.id as string };
    },

    async updatePreparation(id, input) {
      const { data, error } = await supabase
        .from("preparations")
        .update({
          procedure_type_id: input.procedureTypeId,
          name: input.name,
          manufacturer: input.manufacturer,
          favorite: input.favorite,
          ...settingsRow(input),
        })
        .eq("id", id)
        .select("id");
      check(error);
      return Boolean(data && data.length > 0);
    },
  };
}
