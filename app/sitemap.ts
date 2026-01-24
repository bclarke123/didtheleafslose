import type { MetadataRoute } from "next";
import { getAllGameIds } from "./lib/storage";

const BASE_URL = "https://didtheleafslose.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const gameIds = await getAllGameIds();

  const gamePages = gameIds.map((gameId) => ({
    url: `${BASE_URL}/archive/${gameId}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/archive`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...gamePages,
  ];
}
