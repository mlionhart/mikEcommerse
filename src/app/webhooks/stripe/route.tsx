// this will be called by stripe when we have a successful payment. The reason we're using this webhook instead of the product success page is because it's more secure - it's only going to be called when there is a successful payment, it comes DIRECTLY from Stripe, and there's different verifications setup to authenticate that THIS is the correct page

import db from "@/db/db";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {Resend} from "resend";
import PurchaseReceiptEmail from "@/email/PurchaseReceipt";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const resend = new Resend(process.env.RESENT_API_KEY);

// first we need to create a POST event (will be called by Stripe)
export async function POST(req: NextRequest) {
  // this will verify that everything passed to this is actually coming from Stripe. That's why we have the secret key
  const event = await stripe.webhooks.constructEvent(
    await req.text(),
    req.headers.get("stripe-signature") as string,
    process.env.STRIPE_WEBHOOK_SECRET as string
  );

  // all the info we need to create an order for a customer, and we already know that this is verified by Stripe, because of lines 12-15
  if (event.type === "charge.succeeded") {
    const charge = event.data.object;
    const productId = charge.metadata.productId;
    const email = charge.billing_details.email;
    const pricePaidInCents = charge.amount;

    // now we can create order, but first make sure product exists
    const product = await db.product.findUnique({
      where: { id: productId },
    });
    if (product == null || email == null) {
      return new NextResponse("Bad request", { status: 400 });
    }

    // now we want to create a user, or update a user by adding an order to them, and this is made easy through Prisma. upsert() either updates a user or inserts a brand new user.
    // What's happening: creating a brand new user with the following email, and creating a brand new order for them, but if the user already exists in the db, instead it will set their email to the following email (which is fine since it's already their email), and it will add a brand new order for them, so it takes care of both updating and creating all in one
    const userFields = {
      email,
      orders: { create: { productId, pricePaidInCents } },
    };
    const {
      orders: [order],
    } = await db.user.upsert({
      // where field is for update functionality. If email exists in db, it will create a brand new order for that user. If the email doesn't exist, it will create a brand new USER with the email on 36, and add that order on 37 to them
      where: { email },
      create: userFields,
      update: userFields,
      select: { orders: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    // setup info for downloading, email, etc
    const downloadVerification = await db.downloadVerification.create({
      data: {
        productId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      },
    });

    // send email(s)
    await resend.emails.send({
      from: `Support <${process.env.SENDER_EMAIL}>`,
      to: email,
      subject: "Order Confirmation",
      react: <PurchaseReceiptEmail order={ order } product={ product } downloadVerificationId={downloadVerification.id} />,
    })
  }
  // if all code works well, at least send a successful response
  return new NextResponse()
}
