export type EducationLesson = {
  id: string;
  title?: string;
  subtitle?: string;
  starts_at?: string;
  duration_minutes?: number;
  level?: 'beginner' | 'intermediate' | 'advanced' | string;
  cover_url?: string | null;
  is_live?: boolean;
};

export type EducationCourse = {
  id: string;
  title?: string;
  subtitle?: string;
  price?: string | number;
  currency?: string;
  cover_url?: string | null;
  starts_at?: string;
  is_popular?: boolean;
  category?: string;
};

export type EducationHomePayload = {
  featured?: EducationLesson | null;
  live_lessons?: EducationLesson[];
  popular_courses?: EducationCourse[];
  categories?: { id: string; name: string; icon?: string }[];
};

export const normalizeHome = (data: any): EducationHomePayload => {
  const d = data?.data ?? data ?? {};
  return {
    featured: d.featured ?? null,
    live_lessons: Array.isArray(d.live_lessons) ? d.live_lessons : [],
    popular_courses: Array.isArray(d.popular_courses) ? d.popular_courses : [],
    categories: Array.isArray(d.categories) ? d.categories : [],
  };
};
