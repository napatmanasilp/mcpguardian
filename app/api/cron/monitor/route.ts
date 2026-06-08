import { NextResponse } from "next/server";

export const GET = async () => {
  return NextResponse.json(
    { message: "Monitor cron not implemented yet." },
    { status: 501 },
  );
};
