import { NextResponse } from "next/server";

export const POST = async () => {
  return NextResponse.json(
    { message: "Scan endpoint not implemented yet." },
    { status: 501 },
  );
};
