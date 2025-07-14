import { createTRPCRouter } from "~/server/trpc/main";
import { 
  getCategories, 
  createCategory, 
  updateCategory, 
  deleteCategory 
} from "~/server/trpc/procedures/categories";

export const categoriesRouter = createTRPCRouter({
  getAll: getCategories,
  create: createCategory,
  update: updateCategory,
  delete: deleteCategory,
}); 