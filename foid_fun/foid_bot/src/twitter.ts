import { resolve } from "path";
import { config } from "dotenv";
import { TwitterApi } from "twitter-api-v2";

config({ path: resolve(__dirname, "..", "..", ".env.local") });

const client = new TwitterApi({
  appKey: process.env.X_API_KEY!,
  appSecret: process.env.X_API_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN!,
  accessSecret: process.env.X_ACCESS_SECRET!,
});

export async function postTweet(text: string): Promise<string> {
  const tweet = await client.v2.tweet(text);
  return tweet.data.id;
}
