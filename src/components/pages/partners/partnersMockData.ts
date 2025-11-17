// src/screens/tabs/partnersMockData.ts
import { Partner, PartnerCommunity, PartnerGroup } from './partnersTypes';

export const MOCK_PARTNERS: Partner[] = [
  {
    id: '1',
    name: 'Kingdom Builders Intl',
    initials: 'KB',
    tagline: 'Building kingdom-minded businesses.',
    admins: [
      { id: 'a1', name: 'Sarah Johnson', initials: 'SJ', position: 'Founder / CEO' },
      { id: 'a2', name: 'David Kim', initials: 'DK', position: 'COO' },
      { id: 'a3', name: 'Mary O.', initials: 'MO', position: 'Community Lead' },
    ],
  },
  {
    id: '2',
    name: 'Youth Impact Network',
    initials: 'YI',
    tagline: 'Equipping the next generation.',
    admins: [
      { id: 'a4', name: 'John Doe', initials: 'JD', position: 'Director' },
      { id: 'a5', name: 'Rachel M.', initials: 'RM', position: 'Programs Lead' },
    ],
  },
  {
    id: '3',
    name: 'Hope Health Foundation',
    initials: 'HH',
    tagline: 'Health with a kingdom lens.',
    admins: [
      { id: 'a6', name: 'Dr. Faith', initials: 'DF', position: 'Medical Director' },
      { id: 'a7', name: 'James L.', initials: 'JL', position: 'Operations' },
    ],
  },
];

export const MOCK_COMMUNITIES: PartnerCommunity[] = [
  {
    id: 'c1',
    partnerId: '1',
    name: 'Founders Circle',
    description: 'Leaders & founders collaboration space.',
  },
  {
    id: 'c2',
    partnerId: '1',
    name: 'Marketplace Ministries',
    description: 'Business & marketplace focused groups.',
  },
  {
    id: 'c3',
    partnerId: '2',
    name: 'Youth Leaders Hub',
    description: 'Youth pastors & coordinators.',
  },
];

export const MOCK_GROUPS: PartnerGroup[] = [
  // Partner 1 – standalone groups
  { id: 'g1', partnerId: '1', name: '# general', type: 'public' },
  { id: 'g2', partnerId: '1', name: '# announcements', type: 'public' },
  // Partner 1 – in communities
  { id: 'g3', partnerId: '1', name: '# founders-chat', type: 'private', communityId: 'c1' },
  { id: 'g4', partnerId: '1', name: '# marketplace-roundtable', type: 'public', communityId: 'c2' },
  { id: 'g5', partnerId: '1', name: '# marketplace-mentors', type: 'private', communityId: 'c2' },

  // Partner 2
  { id: 'g6', partnerId: '2', name: '# announcements', type: 'public' },
  { id: 'g7', partnerId: '2', name: '# mentorship-hub', type: 'private' },
  { id: 'g8', partnerId: '2', name: '# youth-pastors', type: 'private', communityId: 'c3' },

  // Partner 3
  { id: 'g9', partnerId: '3', name: '# community-updates', type: 'public' },
];
