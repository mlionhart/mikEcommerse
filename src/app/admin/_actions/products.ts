"use server";

import db from "@/db/db";
import { z } from "zod";
import fs from "fs/promises";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import path from "path";

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

export async function addProduct(prevState: unknown, formData: FormData) {
  // Transform form data into an actual object we can use, then parse
  const result = addSchema.safeParse(Object.fromEntries(formData.entries()));
  if (result.success === false) {
    return result.error.formErrors.fieldErrors;
  }

  const data = result.data;

  try {
    // Ensure the products directory exists
    const productsDir = path.join(process.cwd(), 'products');
    console.log(`Creating directory: ${productsDir}`);
    await fs.mkdir(productsDir, { recursive: true });
    const filePath = path.join(productsDir, `${crypto.randomUUID()}-${data.file.name}`);
    console.log(`Writing file to: ${filePath}`);
    await fs.writeFile(filePath, Buffer.from(await data.file.arrayBuffer()));

    // Ensure the public/products directory exists
    const publicProductsDir = path.join(process.cwd(), 'public', 'products');
    console.log(`Creating directory: ${publicProductsDir}`);
    await fs.mkdir(publicProductsDir, { recursive: true });
    const imagePath = path.join('/products', `${crypto.randomUUID()}-${data.image.name}`);
    console.log(`Writing image to: ${path.join('public', imagePath)}`);
    await fs.writeFile(path.join(process.cwd(), 'public', imagePath), Buffer.from(await data.image.arrayBuffer()));

    // Create a new product record in the database
    await db.product.create({
      data: {
        isAvailableForPurchase: false,
        name: data.name,
        description: data.description,
        priceInCents: data.priceInCents,
        filePath,
        imagePath,
      },
    });

    // Refresh cache
    await revalidatePath('/');
    await revalidatePath('/products');

    // Redirect to products page
    return NextResponse.redirect('/admin/products');
  } catch (error) {
    console.error('Error adding product:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
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
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
      // Ignore ENOENT errors, which indicate that the file doesn't exist
    }
  }

  if (product.imagePath) {
    try {
      await fs.unlink(`public${product.imagePath}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
      // Ignore ENOENT errors, which indicate that the file doesn't exist
    }
  }

  // refresh cache (invalidate current data, and get all the data again)
  revalidatePath("/");
  revalidatePath("/products");
}
