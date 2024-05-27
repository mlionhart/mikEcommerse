export async function isValidPassword(
  password: string,
  hashedPassword: string
) {
  return (await hashPassword(password)) === hashedPassword;
}

// encrypting password into something that is very difficult/almost impossible to decrypt
async function hashPassword(password: string) {
  const arrayBuffer = await crypto.subtle.digest(
    "SHA-512",
    new TextEncoder().encode(password)
  );

  // converting to base64 shrinks it down a bit, since the above process will create an extremely long string
  return Buffer.from(arrayBuffer).toString("base64");
}
