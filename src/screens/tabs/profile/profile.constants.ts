// src/screens/tabs/profile/profile.constants.ts
export const fieldLabels: Record<string, string> = {
  avatar: 'Profile photo',
  cover: 'Cover photo',
  headline: 'Headline',
  bio: 'Bio',
  industry: 'Industry',
  contact_phone: 'Phone',
  contact_email: 'Email',
  experience: 'Experience',
  education: 'Education',
  projects: 'Projects',
  skills: 'Skills',
  recommendations: 'Recommendations',
  articles: 'Articles',
  activity: 'Activity',
};

export const visibilityOptions = [
  { value: 'public', label: 'Public' },
  { value: 'contacts', label: 'Contacts (allowlist)' },
  { value: 'custom', label: 'Custom list' },
  { value: 'private', label: 'Only me' },
];

export const walletModes = [
  { value: 'deposit', label: 'Add Money' },
  { value: 'cash_to_credits', label: 'Convert to Credits' },
  { value: 'credits_to_cash', label: 'Convert to Money' },
  { value: 'points_to_credits', label: 'Points to Credits' },
  { value: 'transfer', label: 'Send Gift' },
  { value: 'promo', label: 'Redeem Promo' },
];

export const paymentProviders = [
  { value: 'flutterwave', label: 'Flutterwave' },
  { value: 'mobilemoney_mtn', label: 'MTN MoMo' },
  { value: 'mobilemoney_orange', label: 'Orange Money' },
];
