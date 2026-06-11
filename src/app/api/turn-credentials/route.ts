const CF_TURN_KEY_ID = process.env.NEXT_PUBLIC_CF_TURN_APP_ID || "5a48ca18d6b3e074382d4a76f57a094c";
const CF_TURN_API_TOKEN = process.env.NEXT_PUBLIC_CF_TURN_TOKEN || "ffabce2552a2ddbe99a9fcecb967cf6c49e7bf53dae7f89ab0cb364afcd4370a";

export async function GET() {
  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${CF_TURN_KEY_ID}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CF_TURN_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: 86400 }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[TURN API] failed:", res.status, err);
      return Response.json({ error: `Cloudflare TURN API error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    return Response.json(data);
  } catch (err) {
    console.error("[TURN API] exception:", err);
    return Response.json({ error: "Failed to fetch TURN credentials" }, { status: 502 });
  }
}
