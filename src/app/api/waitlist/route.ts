import { NextResponse } from "next/server";

const waitlist: string[] = [];

export async function POST(request: Request) {
  const { email } = (await request.json()) as { email?: string };

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Ugyldig e-post" }, { status: 400 });
  }

  if (!waitlist.includes(email)) {
    waitlist.push(email);
  }

  return NextResponse.json({ ok: true });
}
