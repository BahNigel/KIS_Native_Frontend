import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';

import ROUTES from '@/network';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';
import { EducationCourse, EducationHomePayload } from '@/screens/broadcast/education/api/education.types';

type Params = { q?: string };

const DEFAULT_HOME: EducationHomePayload = {
  featured: null,
  live_lessons: [],
  popular_courses: [],
  categories: [],
};

const toPrettyCategory = (raw: string | undefined) => {
  if (!raw) return 'General';
  const cleaned = raw.trim().replace(/[_-]+/g, ' ');
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const buildCategories = (courses: EducationCourse[]) => {
  const seen = new Map<string, { id: string; name: string; icon?: string }>();
  courses.forEach((course) => {
    const level = (course.level ?? 'general').trim().toLowerCase() || 'general';
    if (!seen.has(level)) {
      seen.set(level, {
        id: level,
        name: toPrettyCategory(course.level ?? level),
        icon: 'book',
      });
    }
  });
  return Array.from(seen.values());
};

const unwrapList = (response: any) => {
  if (!response) return [];
  const payload = response?.data ?? response;
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
};

const generateId = () => `home-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeBibleCourse = (course: any): EducationCourse => ({
  id: String(course?.id ?? generateId()),
  partner: course?.partner ?? null,
  partner_name: course?.partner_name ?? course?.partner_display_name ?? null,
  title: course?.title,
  subtitle: course?.subtitle,
  description: course?.description,
  cover_image: course?.cover_image ?? course?.image ?? null,
  level: course?.level ?? 'general',
  duration_minutes: course?.duration_minutes,
  is_bible_course: Boolean(course?.is_bible_course),
  is_free: Boolean(course?.is_free),
  is_public: Boolean(course?.is_public),
  price_amount: course?.price_amount ?? null,
  price_currency: course?.price_currency ?? null,
  created_at: course?.created_at,
  source: 'bible_course',
});

const normalizeProfileCourse = (course: any): EducationCourse => ({
  id: String(course?.id ?? generateId()),
  title: course?.title,
  subtitle: course?.summary,
  description: course?.summary,
  cover_image: course?.cover_url ?? null,
  level: (course?.level ?? 'education').toLowerCase(),
  is_custom: true,
  source: 'education_profile',
});

export default function useEducationData({ q = '' }: Params) {
  const [home, setHome] = useState<EducationHomePayload>(DEFAULT_HOME);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  const loadHome = useCallback(async () => {
    setLoading(true);
    const params = q?.trim() ? { q: q.trim() } : undefined;
    try {
      const [coursesRes, lessonsRes, profilesRes] = await Promise.all([
        getRequest(ROUTES.bible.courses, {
          params,
          errorMessage: 'Unable to load courses.',
        }),
        getRequest(ROUTES.broadcasts.lessons, {
          params,
          errorMessage: 'Unable to load lessons.',
        }),
        getRequest(ROUTES.broadcasts.createProfile, {
          errorMessage: 'Unable to load broadcast profiles.',
        }),
      ]);

      const bibleCourses = unwrapList(coursesRes);
      const lessons = unwrapList(lessonsRes);
      const educationProfile = profilesRes?.data?.profiles?.education ?? {};
      const profileCourses = Array.isArray(educationProfile?.courses)
        ? educationProfile.courses
        : [];

      const combinedCourses = [
        ...profileCourses.map(normalizeProfileCourse),
        ...bibleCourses.map(normalizeBibleCourse),
      ];

      const next: EducationHomePayload = {
        featured: lessons[0] ?? null,
        live_lessons: lessons,
        popular_courses: combinedCourses,
        categories: buildCategories(combinedCourses),
      };

      if (mountedRef.current) {
        setHome(next);
      }
    } catch (error: any) {
      console.log('[useEducationData] load failed', error?.message ?? error);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [q]);

  const enrollLesson = useCallback(async (lessonId: string) => {
    const res = await postRequest(ROUTES.broadcasts.lessonEnroll(lessonId), {}, {
      errorMessage: 'Unable to enroll in lesson.',
    });
    if (res?.success === false) return { ok: false };
    DeviceEventEmitter.emit('broadcast.refresh');
    return { ok: true };
  }, []);

  const updateCourse = useCallback((updated: EducationCourse) => {
    setHome((prev) => {
      const updatedCourses = prev.popular_courses.map((course) =>
        course.id === updated.id ? { ...course, ...updated } : course,
      );
      return {
        ...prev,
        popular_courses: updatedCourses,
        categories: buildCategories(updatedCourses),
      };
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadHome();
    return () => {
      mountedRef.current = false;
    };
  }, [loadHome]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('broadcast.refresh', loadHome);
    return () => sub.remove();
  }, [loadHome]);

  return {
    home,
    loading,
    reload: loadHome,
    enrollLesson,
    updateCourse,
  };
}
