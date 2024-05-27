// all order-related actions
"use server";

import db from "@/db/db";

export async function userOrderExists(email: string, productId: string) {
  // check for order (checking if there's an order for that email and that product)
  return (
    (await db.order.findFirst({
      where: { user: { email }, productId },
      select: { id: true },
    })) != null
  );
}
