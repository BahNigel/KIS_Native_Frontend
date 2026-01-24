import { useCallback, useEffect, useRef, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { getRequest } from '@/network/get';
import { postRequest } from '@/network/post';

import {
  EDUCATION_HOME_ENDPOINT,
  EDUCATION_ENROLL_ENDPOINT,
} from '@/screens/broadcast/education/api/education.endpoints';

import {
  EducationHomePayload,
  normalizeHome,
} from '@/screens/broadcast/education/api/education.types';

type Params = { q?: string };

export default function useEducationData({ q = '' }: Params) {
  const [home, setHome] = useState<EducationHomePayload>({
    featured: null,
    live_lessons: [],
    popular_courses: [],
    categories: [],
  });

  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  const loadHome = useCallback(async () => {
    setLoading(true);

    const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    const res = await getRequest(`${EDUCATION_HOME_ENDPOINT}${qs}`, {
      errorMessage: 'Unable to load education.',
    });

    const payload = normalizeHome(res?.data ?? res);

    if (!mountedRef.current) return;
    setHome(payload);
    setLoading(false);
  }, [q]);

  const enroll = useCallback(async (courseId: string) => {
    const res = await postRequest(EDUCATION_ENROLL_ENDPOINT(courseId), {}, {
      errorMessage: 'Unable to enroll.',
    });
    if (res?.success === false) return { ok: false };
    DeviceEventEmitter.emit('broadcast.refresh');
    return { ok: true };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadHome();
    return () => {
      mountedRef.current = false;
    };
  }, [loadHome]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('broadcast.refresh', () => {
      loadHome();
    });
    return () => sub.remove();
  }, [loadHome]);

  return {
    home,
    loading,
    reload: loadHome,
    enroll,
  };
}
