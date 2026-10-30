import type { IsoDate } from "./client";

/** FK1–FK4: a photo the client sent – in «Фото клиента», or in «Лечение» when tied to a course. */
export type ClientPhoto = {
  id: string;
  clientId: string;
  /** FK3: taken during this treatment course – shown in «Лечение», not in «Фото клиента». */
  courseId: string | null;
  /** FK2: when the photo was taken (from the photo, otherwise the day it was added; editable). */
  takenOn: IsoDate;
  storagePath: string;
  createdAt: string;
};

export type ClientPhotoInput = Pick<ClientPhoto, "courseId" | "takenOn" | "storagePath">;
