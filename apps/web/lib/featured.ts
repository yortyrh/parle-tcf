import { API_ROUTES, type FeaturedExercises } from '@parle-tcf/shared';
import { getApiBase } from '@/lib/api';

/** Server-side fetch of the landing teaser; null when the API is unreachable. */
export async function getFeaturedExercises(): Promise<FeaturedExercises | null> {
  try {
    const res = await fetch(`${getApiBase()}${API_ROUTES.exercisesFeatured}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as FeaturedExercises;
  } catch {
    return null;
  }
}
