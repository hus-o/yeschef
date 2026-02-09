import { API_URL } from "../config";

export const api = {
  extractRecipe: async (url: string) => {
    const res = await fetch(`${API_URL}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error("Oops, something went wrong.");
    return res.json();
  },

  getJob: async (jobId: string) => {
    const res = await fetch(`${API_URL}/jobs/${jobId}`);
    if (!res.ok) throw new Error("Oops, something went wrong.");
    return res.json();
  },

  getRecipes: async () => {
    const res = await fetch(`${API_URL}/recipes`);
    if (!res.ok) throw new Error("Oops, something went wrong.");
    return res.json();
  },

  getRecipe: async (id: string) => {
    const res = await fetch(`${API_URL}/recipes/${id}`);
    if (!res.ok) throw new Error("Oops, something went wrong.");
    return res.json();
  },

  getLiveToken: async (recipeId: string, resumeFromStep?: number) => {
    const body: Record<string, unknown> = { recipe_id: recipeId };
    if (resumeFromStep != null) body.resume_from_step = resumeFromStep;

    const res = await fetch(`${API_URL}/live/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Oops, something went wrong.");
    return res.json();
  },
};
