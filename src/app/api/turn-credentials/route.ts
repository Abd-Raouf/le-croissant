const CF_TURN_KEY_ID = process.env.NEXT_PUBLIC_CF_TURN_APP_ID || "5a48ca18d6b3e074382d4a76f57a094c";
const CF_TURN_API_TOKEN = process.env.NEXT_PUBLIC_CF_TURN_TOKEN || "ffabce2552a2ddbe99a9fcecb967cf6c49e7bf53dae7f89ab0cb364afcd4370a";

export async function GET() {
  const details: string[] = [];
  details.push(`KEY_ID: ${CF_TURN_KEY_ID.slice(0, 12)}...`);
  details.push(`TOKEN_LEN: ${CF_TURN_API_TOKEN.length}`);

  try {
    const body = JSON.stringify({ ttl: 86400 });
    details.push(`POST body: ${body}`);

    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${CF_TURN_KEY_ID}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CF_TURN_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body,
      },
    );

    details.push(`status: ${res.status}`);

    if (!res.ok) {
      const err = await res.text();
      details.push(`response: ${err.slice(0, 500)}`);
      return Response.json(
        { error: "Cloudflare TURN API error", details },
        { status: 502 },
      );
    }

    const data: unknown = await res.json();
    return Response.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    details.push(`exception: ${msg}`);
    return Response.json(
      { error: "Failed to fetch TURN credentials", details },
      { status: 502 },
    );
  }
}
