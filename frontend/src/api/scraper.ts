import type { AxiosResponse } from "axios";
import apiClient from "./client";

export interface ParsedIngredient {
  quantity: string;
  unit: string;
  ingredient_name: string;
  notes: string;
}

export interface ScrapeResult {
  scraped_id: number;
  title: string;
  description: string;
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
  source_url: string;
  cover_image_url: string | null;
  ingredients: ParsedIngredient[];
  steps: string[];
}

export const scraperApi = {
  scrape(url: string): Promise<AxiosResponse<ScrapeResult>> {
    return apiClient.post("/scraper/scrape/", { url });
  },
};
