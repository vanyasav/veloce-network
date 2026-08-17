// Fetches this site's content from Directus at build time.
// RESTAURANT_SLUG picks which tenant row to build — set per client deploy.

const DIRECTUS_URL = import.meta.env.DIRECTUS_URL ?? "https://panel.veloce-network.xyz";
const RESTAURANT_SLUG = import.meta.env.RESTAURANT_SLUG ?? "demo-pizzeria";

export interface Translated {
  [lang: string]: string;
}

export interface HoursRow {
  day: string;
  open: string;
  close: string;
  closed: boolean;
}

export interface Restaurant {
  id: number;
  name: string;
  slug: string;
  domain: string | null;
  status: string;
  logo: string | null;
  hero_photo: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  languages: string[] | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  about_text: string | null;
  hours: HoursRow[] | null;
}

export interface MenuCategory {
  id: number;
  name: Translated;
  sort: number | null;
}

export interface MenuItem {
  id: number;
  restaurant: number;
  category: number | null;
  name: Translated;
  description: Translated | null;
  price: string;
  photo: string | null;
  vegan: boolean;
  vegetarian: boolean;
  gluten_free: boolean;
  available: boolean;
  sort: number | null;
}

async function directusFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${DIRECTUS_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Directus request failed: ${path} -> ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.data as T;
}

export function assetUrl(fileId: string | null, params = ""): string | null {
  if (!fileId) return null;
  return `${DIRECTUS_URL}/assets/${fileId}${params}`;
}

export async function getRestaurant(): Promise<Restaurant> {
  const rows = await directusFetch<Restaurant[]>(
    `/items/restaurants?filter[slug][_eq]=${encodeURIComponent(RESTAURANT_SLUG)}&limit=1`
  );
  if (!rows.length) {
    throw new Error(
      `No published restaurant found for slug "${RESTAURANT_SLUG}". Check it exists in Directus and status=published.`
    );
  }
  return rows[0];
}

export async function getMenu(restaurantId: number): Promise<{ categories: MenuCategory[]; items: MenuItem[] }> {
  const [categories, items] = await Promise.all([
    directusFetch<MenuCategory[]>(
      `/items/menu_categories?filter[restaurant][_eq]=${restaurantId}&sort=sort`
    ),
    directusFetch<MenuItem[]>(
      `/items/menu_items?filter[restaurant][_eq]=${restaurantId}&sort=sort`
    ),
  ]);
  return { categories, items };
}
