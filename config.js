export const config = {
  domainSource: "https://7cbe5063-b845-44d8-a79d-37f07db28edd.weweb-preview.io", // Your WeWeb app preview link
  patterns: [
      {
          pattern: "/influencer/[^/]+",
          metaDataEndpoint: "https://pktcxwwyadqahlmajzfh.supabase.co/functions/v1/influencer_metatdata/{slug}"
      }
  ]
};
