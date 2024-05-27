// dealing with data caching and everything else built-in to NextJS
import { unstable_cache as nextCache } from "next/cache";
// for request memoization
import { cache as reactCache } from "react";

// basically a function that any number of arguments of any type that returns a Promise of any
type Callback = (...args: any[]) => Promise<any>;

// this function is essentially emulating the NextJS cache built-in cache function
export function cache<T extends Callback>(
  cb: T,
  keyParts: string[],
  options: { revalidate?: number | false; tags?: string[] } = {}
) {
  // first cache this using React, then nextCashe with keyParts and options
  return nextCache(reactCache(cb), keyParts, options)
}
