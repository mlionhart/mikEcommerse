import db from "@/db/db";
import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { URL } from "url";

const s3 = new S3Client({ region: "us-east-2" });
const s3BaseUrl = "https://econ-site-data.s3.us-east-2.amazonaws.com/";
const bucketName = "econ-site-data"; // Replace with your S3 bucket name

export async function GET(
  req: NextRequest,
  {
    params: { downloadVerificationId },
  }: { params: { downloadVerificationId: string } }
) {
  const data = await db.downloadVerification.findUnique({
    where: { id: downloadVerificationId, expiresAt: { gt: new Date() } },
    select: {
      product: { select: { filePath: true, name: true } },
      expiresAt: true,
    },
  });

  if (data == null) {
    return NextResponse.redirect(
      new URL("/products/download/expired", req.url)
    );
  }

  const key = data.product.filePath.replace(s3BaseUrl, "");

  // need to get all the info from the file (old, commented out code for the file system/local version of the app)
  // const { size } = await fs.stat(data.product.filePath);
  // const file = await fs.readFile(data.product.filePath);
  // const extension = data.product.filePath.split(".").pop();

  try {
    // Get the file from S3
    const command = new GetObjectCommand({ Bucket: bucketName, Key: key });
    const fileData = await s3.send(command);

    // Convert the stream to buffer
    const fileBuffer = await streamToBuffer(fileData.Body as ReadableStream);
    const fileSize = fileData.ContentLength || 0;
    const extension = key.split(".").pop();

    // construct and return download link based on info
    // return new NextResponse(fileBuffer, {
    //   headers: {
    //     "Content-Disposition": `attachment; filename="${data.product.name}.${extension}"`,
    //     "Content-Length": fileSize.toString(),
    //     "Content-Type": fileData.ContentType || "application/octet-stream",
    //   },
    // });
    return new NextResponse(
      `<html><body>
         <h1>Download Information</h1>
         <p>File Name: ${data.product.name}.${extension}</p>
         <p>File Size: ${fileSize}</p>
         <p>Expires At: ${data.expiresAt}</p>
         <p>Current Time: ${new Date().toISOString()}</p>
         <a href="data:application/octet-stream;base64,${fileBuffer.toString("base64")}" download="${data.product.name}.${extension}">Download File</a>
       </body></html>`,
      {
        headers: {
          "Content-Type": "text/html",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching file from S3: ", error);
    return NextResponse.redirect(new URL("/products/download/expired", req.url));
  }
}

// Utility function to convert stream to buffer
function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    function read() {
      reader.read().then(({ done, value }) => {
        if (done) {
          resolve(Buffer.concat(chunks));
        } else {
          chunks.push(value);
          read();
        }
      }).catch(reject);
    }

    read();
  });
}