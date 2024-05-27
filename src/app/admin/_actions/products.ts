"use server";

import db from "@/db/db";
import { z } from "zod";
import fs from "fs/promises";
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

// actions must be async
export async function addProduct(prevState: unknown, formData: FormData) {
  // transform form data into an actual object we can use, then parse
  const result = addSchema.safeParse(Object.fromEntries(formData.entries()));
  if (result.success === false) {
    return result.error.formErrors.fieldErrors;
  }

  const data = result.data;

  await fs.mkdir("products", { recursive: true });
  const filePath = `products/${crypto.randomUUID()}-${data.file.name}`;
  await fs.writeFile(filePath, Buffer.from(await data.file.arrayBuffer()));

  await fs.mkdir("public/products", { recursive: true });
  // don't need public in path because it will assume public once you're actually using the path
  const imagePath = `/products/${crypto.randomUUID()}-${data.image.name}`;
  await fs.writeFile(
    `public${imagePath}`,
    Buffer.from(await data.image.arrayBuffer())
  );

  // .create() is a Prisma method for creating a new record in the db. In this case, in the products table. The method takes an object. The keys should match the column names in your table, and the values are the data you want to insert.
  await db.product.create({
    data: {
      // make product unavailable upon creation by default
      isAvailableForPurchase: false,
      name: data.name,
      description: data.description,
      priceInCents: data.priceInCents,
      filePath,
      imagePath,
    },
  });

  // refresh cache (invalidate current data, and get all the data again)
  revalidatePath("/")
  revalidatePath("/products")

  // After clicking save to create the product, redirect to products page
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
  const data = result.data;
  // get product based on id
  const product = await db.product.findUnique({ where: { id } });

  if (product === null) return notFound();

  // we only want to update the file and image path if they actually changed.
  let filePath = product.filePath;
  // if we already have a file, delete the old file and upload a brand new one
  if (data.file != null && data.file.size > 0) {
    // first, unlink (remove) original file
    await fs.unlink(product.filePath);
    // create new path
    filePath = `products/${crypto.randomUUID()}-${data.file.name}`;
    // save file
    await fs.writeFile(filePath, Buffer.from(await data.file.arrayBuffer()));
  }

  // basically defaulting to current image path, but if we pass up a new one, we delete the current one and create a brand new one
  let imagePath = product.imagePath;
  if (data.image != null && data.image.size > 0) {
    await fs.unlink(`public${product.imagePath}`);
    imagePath = `/products/${crypto.randomUUID()}-${data.image.name}`;
    await fs.writeFile(
      `public${imagePath}`,
      Buffer.from(await data.image.arrayBuffer())
    );
  }

  // Only difference between addProduct and updateProduct is here we change to product.update, add a where: {id} clause, and remove the isAvailableForPurchase field
  await db.product.update({
    where: { id },
    data: {
      // make product unavailable upon creation by default
      // isAvailableForPurchase: false,
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

  // if product deletion successful, we want to take the product and unlink those files. Make sure to put these dirs in .gitignore bc they are purely for testing purposes
  if (product.filePath) {
    try {
      await fs.unlink(product.filePath);
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
      // Ignore ENOENT errors, which indicate that the file doesn't exist
    }
  }

  if (product.imagePath) {
    try {
      await fs.unlink(`public${product.imagePath}`);
    } catch (err) {
      if (err.code !== "ENOENT") {
        throw err;
      }
      // Ignore ENOENT errors, which indicate that the file doesn't exist
    }
  }

  // refresh cache (invalidate current data, and get all the data again)
  revalidatePath("/");
  revalidatePath("/products");
}
