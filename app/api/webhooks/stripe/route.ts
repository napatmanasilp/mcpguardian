import { NextResponse } from "next/server";

export const POST = async () => {
  return NextResponse.json(
    { message: "Stripe webhook not implemented yet." },
    { status: 501 },
  );
};
