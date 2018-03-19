import { zfill } from "./string";

export const getTimer = number => zfill(Math.floor(number / 60), 2) + ":" + zfill(number % 60, 2);
