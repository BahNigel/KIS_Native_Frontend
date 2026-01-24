type BroadcastSourceMeta = {
  type: string;
  id?: string | null;
  name?: string;
  verified?: boolean;
  allow_subscribe?: boolean;
  is_subscribed?: boolean;
};

type BroadcastFeedItem = {
  id: string;
  source_type: string;
  title?: string;
  text_plain?: string;
  attachments?: any[];
  author?: { display_name?: string; avatar_url?: string; id?: string };
  created_at?: string;
  broadcasted_at?: string;
  reaction_count?: number;
  comment_count?: number;
  share_count?: number;
  is_live?: boolean;
  video_duration_seconds?: number;
  source?: BroadcastSourceMeta;
};

type TrendingClipItem = {
  id: string;
  title?: string;
  body?: string;
  broadcastedAt?: string;
  attachments?: any[];
  engagement?: { reactions?: number; comments?: number };
};

const nowMinus = (mins: number) => new Date(Date.now() - mins * 60000).toISOString();

export const makeMockFeedItems = (): BroadcastFeedItem[] => {
  return [
    {
      id: 'feed_1',
      source_type: 'community',
      title: '5 Essential Steps to Kickstart Your Startup 🚀',
      text_plain:
        'Here are the top five steps every new founder should tackle to get the startup off the ground. Read more',
      broadcasted_at: nowMinus(9),
      reaction_count: 1200,
      comment_count: 153,
      share_count: 60,
      is_live: true,
      video_duration_seconds: 165,
      attachments: [
        { kind: 'image', url: 'https://picsum.photos/seed/kis1/800/600', thumb_url: 'https://picsum.photos/seed/kis1t/400/300' },
        { kind: 'image', url: 'https://picsum.photos/seed/kis2/800/600', thumb_url: 'https://picsum.photos/seed/kis2t/400/300' },
      ],
      author: { display_name: 'Startup Insights', avatar_url: '' },
      source: {
        type: 'channel',
        id: 'startup_insights',
        name: 'Startup Insights',
        verified: true,
        allow_subscribe: true,
        is_subscribed: false,
      },
    },
    {
      id: 'feed_2',
      source_type: 'market',
      title: 'Tech Stocks Surge, Drive Market Rally Today 📈',
      text_plain: 'A quick breakdown of today’s rally and what it means for the week ahead.',
      broadcasted_at: nowMinus(7),
      reaction_count: 1818,
      comment_count: 65,
      share_count: 76,
      is_live: false,
      video_duration_seconds: 145,
      attachments: [
        { kind: 'video', url: 'https://picsum.photos/seed/kis3/800/600', thumb_url: 'https://picsum.photos/seed/kis3t/400/300' },
        { kind: 'video', url: 'https://picsum.photos/seed/kis4/800/600', thumb_url: 'https://picsum.photos/seed/kis4t/400/300' },
      ],
      author: { display_name: 'Findull Weekly', avatar_url: '' },
      source: {
        type: 'channel',
        id: 'findull_weekly',
        name: 'Findull Weekly',
        verified: true,
        allow_subscribe: true,
        is_subscribed: false,
      },
    },
  ];
};

export const makeMockTrendingClips = (): TrendingClipItem[] => {
  return [
    {
      id: 'clip_1',
      title: 'Postgraduate',
      body: 'The Future of Artificial Intelligence',
      broadcastedAt: nowMinus(12),
      attachments: [{ kind: 'image', url: 'https://picsum.photos/seed/kis5/900/600' }],
      engagement: { reactions: 335, comments: 44 },
    },
    {
      id: 'clip_2',
      title: 'CryptoDaily',
      body: 'Top Crypto News — what moved the market',
      broadcastedAt: nowMinus(20),
      attachments: [{ kind: 'image', url: 'https://picsum.photos/seed/kis6/900/600' }],
      engagement: { reactions: 120, comments: 55 },
    },
  ];
};
