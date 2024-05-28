"use server";

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import db from "@/db/db";
import { z } from "zod";
import crypto from "crypto";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// creating our own file schema for file and image below, since there isn't one built in
const fileSchema = z.instanceof(File, { message: "Required" });
const imageSchema = fileSchema.refine(
  (file) => file.size === 0 || file.type.startsWith("image/")
);

const addSchema = z.object({
  // min(1) makes sure it's required
  name: z.string().min(1),
  description: z.string().min(1),
  priceInCents: z.coerce.number().int().min(1),
  file: fileSchema.refine((file) => file.size > 0, "Required"),
  image: imageSchema.refine((file) => file.size > 0, "Required"),
});

const s3 = new S3Client({ region: "us-east-2" }); // Replace with your AWS region

export async function addProduct(
  prevState: unknown,
  formData: FormData
): Promise<unknown> {
  const result = addSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!result.success) {
    return result.error.formErrors.fieldErrors;
  }

  const data = result.data as {
    name: string;
    description: string;
    priceInCents: number;
    file: File;
    image: File;
  };
  const bucketName = "econ-site-data"; // Replace with your S3 bucket name

  // Generate unique file names
  const fileUUID = crypto.randomUUID();
  const imageUUID = crypto.randomUUID();
  const fileKey = `${fileUUID}-${data.file.name}`;
  const imageKey = `${imageUUID}-${data.image.name}`;

  // Upload file to S3
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      Body: Buffer.from(await data.file.arrayBuffer()),
      ContentType: data.file.type,
    })
  );

  // Upload image to S3
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: imageKey,
      Body: Buffer.from(await data.image.arrayBuffer()),
      ContentType: data.image.type,
    })
  );

  // Save product details in the database
  await db.product.create({
    data: {
      isAvailableForPurchase: false,
      name: data.name,
      description: data.description,
      priceInCents: data.priceInCents,
      filePath: fileKey,
      imagePath: imageKey,
    },
  });

  revalidatePath("/");
  revalidatePath("/products");

  redirect("/admin/products");
}

// same as addSchema, but extending it to change the file to be just default file schema, make it optional, and do the same with image
const editSchema = addSchema.extend({
  file: fileSchema.optional(),
  image: imageSchema.optional(),
});

export async function updateProduct(
  id: string,
  prevState: unknown,
  formData: FormData
) {
  // transform form data into an actual object we can use, then parse
  const result = editSchema.safeParse(Object.fromEntries(formData.entries()));
  if (result.success === false) {
    return result.error.formErrors.fieldErrors;
  }

  // get data
  const data = result.data as {
    name: string;
    description: string;
    priceInCents: number;
    file?: File;
    image?: File;
  };
  // get product based on id
  const product = await db.product.findUnique({ where: { id } });

  if (product === null) return notFound();

  // we only want to update the file and image path if they actually changed.
  let filePath = product.filePath;
  // if we already have a file, delete the old file and upload a brand new one
  if (data.file != null && data.file.size > 0) {
    // Delete the old file from S3
    await s3.send(
      new DeleteObjectCommand({
        Bucket: "econ-site-data",
        Key: product.filePath,
      })
    );
    // Generate new file key and upload the new file
    const fileUUID = crypto.randomUUID();
    filePath = `${fileUUID}-${data.file.name}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: "econ-site-data",
        Key: filePath,
        Body: Buffer.from(await data.file.arrayBuffer()),
        ContentType: data.file.type,
      })
    );
  }

  // basically defaulting to current image path, but if we pass up a new one, we delete the current one and create a brand new one
  let imagePath = product.imagePath;
  if (data.image != null && data.image.size > 0) {
    // Delete the old image from S3
    await s3.send(
      new DeleteObjectCommand({
        Bucket: "your-bucket-name",
        Key: product.imagePath,
      })
    );
    // Generate new image key and upload the new image
    const imageUUID = crypto.randomUUID();
    imagePath = `${imageUUID}-${data.image.name}`;
    await s3.send(
      new PutObjectCommand({
        Bucket: "econ-site-data",
        Key: imagePath,
        Body: Buffer.from(await data.image.arrayBuffer()),
        ContentType: data.image.type,
      })
    );
  }

  // Only difference between addProduct and updateProduct is here we change to product.update, add a where: {id} clause, and remove the isAvailableForPurchase field
  await db.product.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      priceInCents: data.priceInCents,
      filePath,
      imagePath,
    },
  });

  // refresh cache (invalidate current data, and get all the data again)
  revalidatePath("/");
  revalidatePath("/products");

  // After clicking save to create the product, redirect to products page
  redirect("/admin/products");
}

export async function toggleProductAvailability(
  id: string,
  isAvailableForPurchase: boolean
) {
  await db.product.update({
    where: { id },
    data: {
      isAvailableForPurchase,
    },
  });

  // refresh cache (invalidate current data, and get all the data again)
  revalidatePath("/");
  revalidatePath("/products");
}

export async function deleteProduct(id: string) {
  const product = await db.product.delete({ where: { id } });

  if (product == null) return notFound();

  // Delete files from S3 if they exist
  if (product.filePath) {
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: "econ-site-data",
          Key: product.filePath,
        })
      );
    } catch (err) {
      console.error("Failed to delete file from S3:", err);
    }
  }

  if (product.imagePath) {
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: "econ-site-data",
          Key: product.imagePath,
        })
      );
    } catch (err) {
      console.error("Failed to delete image from S3:", err);
    }
  }

  // refresh cache (invalidate current data, and get all the data again)
  revalidatePath("/");
  revalidatePath("/products");
}
