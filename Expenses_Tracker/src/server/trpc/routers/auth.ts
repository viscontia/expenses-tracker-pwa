import { createTRPCRouter } from "~/server/trpc/main";
import { register, login, getCurrentUser, updatePreferences } from "~/server/trpc/procedures/auth";

export const authRouter = createTRPCRouter({
  register,
  login,
  getCurrentUser,
  updatePreferences,
}); 