import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { recipesApi, type Recipe, type Tag } from "../../api/recipes";
import CoverImageInput from "../../components/recipes/CoverImageInput";
import IngredientEditor, {
  type IngredientRow,
} from "../../components/recipes/form/IngredientEditor";
import StepEditor, { type StepRow } from "../../components/recipes/form/StepEditor";
import TagsInput from "../../components/recipes/form/TagsInput";

interface BasicFields {
  title: string;
  description: string;
  servings: number;
  prep_time: number | "";
  cook_time: number | "";
  source_url: string;
  category_id: number | "";
}

const genId = () => Math.random().toString(36).slice(2);
const emptyIngredient = (): IngredientRow => ({
  _id: genId(),
  ingredient_name: "",
  quantity: "",
  unit: "",
  notes: "",
});
const emptyStep = (): StepRow => ({ _id: genId(), description: "" });

export default function RecipeFormPage() {
  const { id } = useParams<{ id: string }>();
  const recipeId = id ? Number(id) : null;
  const isEdit = !!recipeId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState("");
  const [ingredients, setIngredients] = useState<IngredientRow[]>([emptyIngredient()]);
  const [steps, setSteps] = useState<StepRow[]>([emptyStep()]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<BasicFields>({
    defaultValues: {
      title: "",
      description: "",
      servings: 4,
      prep_time: "",
      cook_time: "",
      source_url: "",
      category_id: "",
    },
  });

  const { data: existingRecipe, isLoading: isLoadingRecipe } = useQuery<Recipe>({
    queryKey: ["recipe", recipeId],
    queryFn: () => recipesApi.get(recipeId!).then((r) => r.data),
    enabled: isEdit,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: () => recipesApi.listCategories().then((r) => r.data.results ?? []),
    staleTime: Infinity,
  });

  const { mutate: createCategory, isPending: isCreatingCategory } = useMutation({
    mutationFn: (name: string) => recipesApi.createCategory(name),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setValue("category_id", res.data.id);
      setNewCategoryName("");
      setAddingCategory(false);
    },
  });

  // Pre-fill when editing
  useEffect(() => {
    if (!existingRecipe) return;
    reset({
      title: existingRecipe.title,
      description: existingRecipe.description ?? "",
      servings: existingRecipe.servings,
      prep_time: existingRecipe.prep_time ?? "",
      cook_time: existingRecipe.cook_time ?? "",
      source_url: existingRecipe.source_url ?? "",
      category_id: existingRecipe.category?.id ?? "",
    });
    setCoverUrl(existingRecipe.cover_image_url ?? "");
    if (existingRecipe.ingredients?.length) {
      setIngredients(
        existingRecipe.ingredients.map((ing) => ({
          _id: genId(),
          ingredient_name: ing.ingredient_name,
          quantity: ing.quantity ? String(parseFloat(ing.quantity)) : "",
          unit: ing.unit ?? "",
          notes: ing.notes ?? "",
        }))
      );
    }
    if (existingRecipe.steps?.length) {
      setSteps(existingRecipe.steps.map((s) => ({ _id: genId(), description: s.description })));
    }
    if (existingRecipe.tags?.length) {
      setSelectedTags(existingRecipe.tags);
    }
  }, [existingRecipe, reset]);

  const saveRecipe = async (data: BasicFields, visibility: "public" | "private") => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const payload = {
        title: data.title,
        description: data.description || undefined,
        servings: Number(data.servings),
        prep_time: data.prep_time !== "" ? Number(data.prep_time) : null,
        cook_time: data.cook_time !== "" ? Number(data.cook_time) : null,
        source_url: data.source_url || null,
        category_id: data.category_id !== "" ? Number(data.category_id) : null,
        visibility,
        cover_image_url: coverUrl || null,
        tag_ids: selectedTags.map((t) => t.id),
      };

      let recipe: Recipe;
      if (isEdit) {
        recipe = (await recipesApi.update(recipeId!, payload)).data;
      } else {
        recipe = (await recipesApi.create(payload)).data;
      }

      // Bulk update ingredients
      const ingPayload = ingredients
        .filter((r) => r.ingredient_name.trim())
        .map((r, i) => ({
          ingredient_name: r.ingredient_name.trim(),
          quantity: r.quantity || null,
          unit: r.unit || "",
          notes: r.notes || "",
          order: i,
        }));
      await recipesApi.updateIngredients(recipe.id, ingPayload);

      // Bulk update steps
      const stepPayload = steps
        .filter((s) => s.description.trim())
        .map((s, i) => ({ order: i + 1, description: s.description.trim() }));
      await recipesApi.updateSteps(recipe.id, stepPayload);

      // Upload cover image file if chosen
      if (coverFile) {
        await recipesApi.uploadCoverImage(recipe.id, coverFile);
      }

      navigate(`/recipes/${recipe.id}`);
    } catch (err) {
      setSaveError("Something went wrong. Please try again.");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEdit && isLoadingRecipe) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-40 bg-gray-200 rounded" />
        <div className="h-40 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isEdit ? "Edit Recipe" : "New Recipe"}
      </h1>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
        {/* ── Basic info ─────────────────────────────────────────────────────── */}
        <section className="bg-white border rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Basic Info
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              {...register("title", { required: "Title is required" })}
              placeholder="e.g. Grandma's Lasagna"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {errors.title && (
              <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              {...register("description")}
              rows={3}
              placeholder="A short description of the recipe…"
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Servings</label>
              <input
                type="number"
                min={1}
                {...register("servings", { min: 1 })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prep (min)</label>
              <input
                type="number"
                min={0}
                placeholder="0"
                {...register("prep_time")}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cook (min)</label>
              <input
                type="number"
                min={0}
                placeholder="0"
                {...register("cook_time")}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              {addingCategory ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (newCategoryName.trim()) createCategory(newCategoryName.trim());
                      }
                      if (e.key === "Escape") setAddingCategory(false);
                    }}
                    placeholder="Category name…"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    type="button"
                    disabled={isCreatingCategory || !newCategoryName.trim()}
                    onClick={() => createCategory(newCategoryName.trim())}
                    className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {isCreatingCategory ? "…" : "Add"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingCategory(false)}
                    className="px-3 py-2 border rounded-lg text-sm text-gray-500 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    {...register("category_id")}
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                  >
                    <option value="">None</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setAddingCategory(true)}
                    className="px-3 py-2 border rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:border-green-400 hover:text-green-600 transition-colors"
                    title="Add new category"
                  >
                    + New
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source URL</label>
              <input
                type="url"
                placeholder="https://…"
                {...register("source_url")}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        </section>

        {/* ── Tags ───────────────────────────────────────────────────────────── */}
        <section className="bg-white border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Tags
          </h2>
          <p className="text-xs text-gray-400 mb-3">
            Type to search existing tags or create new ones.
          </p>
          <TagsInput value={selectedTags} onChange={setSelectedTags} />
        </section>

        {/* ── Cover image ────────────────────────────────────────────────────── */}
        <section className="bg-white border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Cover Image
          </h2>
          <CoverImageInput
            currentUrl={existingRecipe?.cover_image || existingRecipe?.cover_image_url}
            onFileSelect={setCoverFile}
            onUrlChange={setCoverUrl}
          />
        </section>

        {/* ── Ingredients ────────────────────────────────────────────────────── */}
        <section className="bg-white border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Ingredients
          </h2>
          <p className="text-xs text-gray-400 mb-4">
            Drag ⠿ to reorder. Type an ingredient name and select from suggestions.
          </p>
          <div className="hidden sm:flex gap-2 text-xs text-gray-400 mb-2 pl-8 pr-8">
            <span className="w-16">Qty</span>
            <span className="w-20">Unit</span>
            <span className="flex-1">Ingredient</span>
            <span className="w-28">Notes</span>
          </div>
          <IngredientEditor value={ingredients} onChange={setIngredients} />
        </section>

        {/* ── Steps ──────────────────────────────────────────────────────────── */}
        <section className="bg-white border rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Steps
          </h2>
          <p className="text-xs text-gray-400 mb-4">Drag ⠿ to reorder steps.</p>
          <StepEditor value={steps} onChange={setSteps} />
        </section>

        {/* ── Save buttons ───────────────────────────────────────────────────── */}
        {saveError && (
          <p className="text-red-500 text-sm text-center">{saveError}</p>
        )}

        <div className="flex flex-wrap gap-3 items-center pt-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSubmit((data) => saveRecipe(data, "private"))}
            className="px-6 py-2.5 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {isSaving ? "Saving…" : "Save as Draft"}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSubmit((data) => saveRecipe(data, "public"))}
            className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? "Publishing…" : "Publish"}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="ml-auto px-4 py-2 text-gray-400 hover:text-gray-600 text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
