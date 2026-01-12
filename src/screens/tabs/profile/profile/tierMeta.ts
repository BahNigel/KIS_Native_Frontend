// src/screens/tabs/profile/profile/tierMeta.ts
export const tierMetaFor = (tier: any) => {
  const candidate =
    typeof tier === 'string'
      ? { name: tier }
      : tier;
  const name = String(candidate?.name ?? candidate?.code ?? candidate?.slug ?? '').toLowerCase();
  const features = candidate?.features_json ?? {};

  const tierRank =
    typeof tier?.tier_rank === 'number'
      ? tier.tier_rank
      : name.includes('partner pro')
      ? 5
      : name.includes('partner')
      ? 4
      : name.includes('business pro')
      ? 3
      : name.includes('business')
      ? 2
      : name.includes('pro')
      ? 1
      : 0;

  const tierSegment =
    candidate?.tier_segment ||
    (name.includes('partner') ? 'partner' : name.includes('business') ? 'business' : 'personal');

  const addFeature = (text: string, list: string[]) => {
    if (text && !list.includes(text)) list.push(text);
  };

  let badge = candidate?.feature_badge || '';
  let tagline = candidate?.feature_tagline || 'Built for everyday growth';
  let list: string[] = Array.isArray(candidate?.feature_list) ? [...candidate.feature_list] : [];
  let highlight = candidate?.feature_highlight || '';

  // ✅ YOUR EXACT RULES (kept)
  if (!list.length && name.includes('partner pro')) {
    tagline = 'Global partner networks & enterprise ops';
    badge = 'Partner Pro';
    highlight = 'Unlimited partner orgs + automation ops';
    list = [
      'Unlimited partner organizations',
      'Enterprise automation & API/webhooks',
      'Dedicated revenue & giving ops hub',
      'Advanced analytics & forecasting',
      'Priority compliance & governance controls',
      'Global roles & permission teams',
      'Concierge onboarding & migration',
    ];
  } else if (!list.length && name.includes('partner')) {
    tagline = 'Organizations, ministries & enterprises';
    badge = 'Partner';
    highlight = 'Multi-account orgs + revenue tools';
    list = [
      'Verified organization profile',
      'Multiple admins & roles',
      'Live streaming + events',
      'Donations & revenue tools',
      'Advanced analytics dashboard',
      'Community & group management at scale',
      'Priority support',
      'Partner webhooks & automations',
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

  // Optional: append numeric feature caps if available
  addFeature(`Communities: ${features.communities ?? 'Included'}`, list);
  addFeature(`Groups per community: ${features.groups_per_community ?? 'Included'}`, list);
  addFeature(`AI queries/day: ${features.ai_queries_per_day ?? 'Included'}`, list);
  addFeature(`Storage: ${features.storage_gb ?? 'Included'} GB`, list);
  if (features.partner_accounts !== undefined && features.partner_accounts !== null) {
    const raw = features.partner_accounts;
    const label =
      typeof raw === 'string'
        ? raw
        : Number.isNaN(Number(raw))
        ? String(raw)
        : String(raw);
    addFeature(`Partner accounts: ${label}`, list);
  }

  return {
    badge,
    tagline,
    highlight,
    features: list.slice(0, 8), // keep it clean in UI
    tierRank,
    tierSegment,
  };
};
