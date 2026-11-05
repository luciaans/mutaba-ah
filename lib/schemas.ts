import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(32).regex(/^[a-z0-9._-]+$/),
  password: z.string().min(1).max(256),
});

export type LoginValues = z.infer<typeof loginSchema>;
