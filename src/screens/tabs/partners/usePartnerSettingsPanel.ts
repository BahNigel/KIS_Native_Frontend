import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { PartnerSettingsSection } from '@/components/partners/settings/partnerSettingsData';

export const usePartnerSettingsPanel = (
  width: number,
  sections: PartnerSettingsSection[],
) => {
  const [activeSectionKey, setActiveSectionKey] = useState<string | null>(null);
  const panelWidth = useMemo(() => width, [width]);
  const panelTranslateX = useRef(new Animated.Value(panelWidth)).current;

  useEffect(() => {
    if (!activeSectionKey) {
      panelTranslateX.setValue(panelWidth);
    }
  }, [panelWidth, activeSectionKey, panelTranslateX]);

  const openSection = (sectionKey: string) => {
    setActiveSectionKey(sectionKey);
    requestAnimationFrame(() => {
      panelTranslateX.setValue(panelWidth);
      Animated.timing(panelTranslateX, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start();
    });
  };

  const closePanel = () => {
    Animated.timing(panelTranslateX, {
      toValue: panelWidth,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setActiveSectionKey(null);
    });
  };

  const activeSection = useMemo(
    () => sections.find((s) => s.key === activeSectionKey),
    [activeSectionKey, sections],
  );

  return {
    panelWidth,
    panelTranslateX,
    activeSectionKey,
    activeSection,
    openSection,
    closePanel,
    isOpen: Boolean(activeSectionKey),
  };
};
