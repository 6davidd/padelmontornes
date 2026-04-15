import { supabase } from "./supabase";

export type Court = {
  id: number;
  name: string;
};

let cachedCourts: Court[] | undefined;
let courtsRequest: Promise<Court[]> | null = null;

export function setCachedCourts(courts: Court[]) {
  cachedCourts = courts;
}

export async function getCourts(): Promise<Court[]> {
  if (cachedCourts) {
    return cachedCourts;
  }

  if (!courtsRequest) {
    courtsRequest = (async () => {
      const { data, error } = await supabase
        .from("courts")
        .select("id,name")
        .order("id", { ascending: true });

      if (error) {
        throw error;
      }

      cachedCourts = (data ?? []) as Court[];
      return cachedCourts;
    })().finally(() => {
      courtsRequest = null;
    });
  }

  return courtsRequest;
}
