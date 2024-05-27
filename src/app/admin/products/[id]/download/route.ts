import fs from 'fs/promises';
import db from "@/db/db";
import { notFound } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params: { id } }: { params: { id: string } }
) {
  const product = await db.product.findUnique({
    where: { id },
    select: { filePath: true, name: true },
  });

  // if can't find product
  if (product == null) return notFound()

  // need to get all the info from the file
  const {size} = await fs.stat(product.filePath)
  const file = await fs.readFile(product.filePath)
  const extension = product.filePath.split('.').pop();

  // construct and return download link based on info
  return new NextResponse(file, {headers: {
    "Content-Disposition": `attachment; filename="${product.name}.${extension}"`,
    "Content-Length": size.toString(),
  }})
}
