import { z } from "zod";

export const chatMessageSchema = z.object({
  body: z.string().trim().min(1, "Пустое сообщение").max(4000, "Сообщение длиннее 4000 символов"),
});
