import { TwitterApi } from "twitter-api-v2";

let client: TwitterApi | null = null;

function getClient(): TwitterApi {
  if (!client) {
    client = new TwitterApi({
      appKey: process.env.X_API_KEY!,
      appSecret: process.env.X_API_SECRET!,
      accessToken: process.env.X_ACCESS_TOKEN!,
      accessSecret: process.env.X_ACCESS_SECRET!,
    });
  }
  return client;
}

export async function postTweet(text: string): Promise<string> {
  const tweet = await getClient().v2.tweet(text);
  return tweet.data.id;
}
