export interface Website {
  id: string;
  name: string;
  url: string;
  cms: 'wordpress' | 'custom' | 'shopify';
  connected: boolean;
}

export interface SocialChannel {
  id: 'linkedin' | 'twitter' | 'instagram' | 'facebook';
  name: string;
  connected: boolean;
  handle: string;
  analytics: {
    followers: number;
    engagementRate: number;
    clicks: number;
    impressions: number;
  };
}

export interface ScheduledPost {
  id: string;
  title: string;
  content: string;
  seoKeywords: string[];
  scheduledAt: string; // ISO string
  targetWebsites: string[]; // Website IDs
  sendToSocials: boolean;
  socialPlatforms: ('linkedin' | 'twitter' | 'instagram' | 'facebook')[];
  socialCaption?: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  readTime: number;
  publishedUrl?: string;
  seoScore?: number;
}

export interface ChannelPerformance {
  date: string;
  views: number;
  organicClicks: number;
  socialClicks: number;
  bounceRate: number;
}

export interface IntegrationCredentials {
  googleAnalyticsConnected: boolean;
  googleAnalyticsPropertyId: string;
  searchConsoleConnected: boolean;
  searchConsoleSiteUrl: string;
  linkedinConnected: boolean;
  twitterConnected: boolean;
  wordpressConnected: boolean;
}
