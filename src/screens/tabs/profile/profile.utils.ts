export const makeUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const formatMoney = (cents = 0) => {
  const value = Math.max(0, cents) / 100;
  return `${value.toFixed(2)}`;
};

export const tierMetaFor = (tier: any) => {
  const name = String(tier?.name ?? '').toLowerCase();
  const features = tier?.features_json ?? {};
  const addFeature = (text: string, list: string[]) => {
    if (text && !list.includes(text)) list.push(text);
  };

  let badge = tier?.feature_badge || '';
  let tagline = tier?.feature_tagline || 'Built for everyday growth';
  let list: string[] = Array.isArray(tier?.feature_list) ? [...tier.feature_list] : [];
  let highlight = tier?.feature_highlight || '';

  if (!list.length && name.includes('partner')) {
    tagline = 'Organizations, ministries & enterprises';
    badge = 'Partner';
    highlight = 'Multi-account orgs + revenue tools';
    list = [
      'Verified organization profile',
      'Multiple admins & roles',
      'Live streaming + events',
      'Donations & revenue tools',
      'Advanced analytics dashboard',
      'Priority support',
    ];
  } else if (!list.length && name.includes('business pro')) {
    tagline = 'High-impact teams and creators';
    badge = 'Most popular';
    highlight = 'Advanced analytics + team workflows';
    list = [
      'Unlimited communities & groups',
      'Team collaboration tools',
      'Advanced insights & reporting',
      'Priority moderation tools',
      'Branding controls',
      'Faster support response',
    ];
  } else if (!list.length && name.includes('business')) {
    tagline = 'Teams, growth & visibility';
    highlight = 'KIS Business broadcast + storefront';
    list = [
      'KIS Business broadcast channel',
      'Business profile + CTA buttons',
      'Multiple admins for business page',
      'Business insights & audience metrics',
      'Basic catalog for services/products',
      'Promo codes + offers',
      'Auto-reply & business hours',
      'Featured discovery boost',
    ];
  } else if (!list.length && name.includes('pro')) {
    tagline = 'Creators and power users';
    highlight = 'Enhanced profile + higher limits';
    list = [
      'More communities & groups',
      'Enhanced profile visibility',
      'Higher media limits',
      'Advanced messaging tools',
      'Priority search ranking',
      'Extended support',
    ];
  } else if (!list.length) {
    tagline = 'Start free, upgrade anytime';
    highlight = 'Everything you need to begin';
    list = [
      'Direct messaging',
      'Core community access',
      'Standard profile',
      'Basic storage',
      'Search & discovery',
      'Standard support',
    ];
  }

  addFeature(`Communities: ${features.communities ?? 'Included'}`, list);
  addFeature(`Groups per community: ${features.groups_per_community ?? 'Included'}`, list);
  addFeature(`AI queries/day: ${features.ai_queries_per_day ?? 'Included'}`, list);
  addFeature(`Storage: ${features.storage_gb ?? 'Included'}`, list);

  return { badge, tagline, highlight, features: list.slice(0, 8) };
};
