import React from 'react';
import EducationDiscoverPage from '@/screens/broadcast/education/EducationDiscoverPage';

type Props = {
  searchTerm?: string;
  searchContext?: string;
};

export default function BroadcastEducationPage({ searchTerm, searchContext }: Props) {
  return <EducationDiscoverPage searchTerm={searchTerm} searchContext={searchContext} />;
}
