// // dealing with data caching and everything else built-in to NextJS
// import { unstable_cache as nextCache } from "next/cache";
// // for request memoization
// import { cache as reactCache } from "react";

// // basically a function that any number of arguments of any type that returns a Promise of any
// type Callback = (...args: any[]) => Promise<any>;

// // this function is essentially emulating the NextJS cache built-in cache function
// export function cache<T extends Callback>(
//   cb: T,
//   keyParts: string[],
//   options: { revalidate?: number | false; tags?: string[] } = {}
// ) {
//   // first cache this using React, then nextCashe with keyParts and options
//   return nextCache(reactCache(cb), keyParts, options)  
// }

import { unstable_cache as nextCache } from "next/cache";
import { cache as reactCache } from "react";

// Define a callback type that accepts an arbitrary number of arguments and returns a Promise of type T
type Callback<T> = (...args: unknown[]) => Promise<T>;

// The cache function will take a callback of type T, keyParts, and options, and return a function that returns a Promise of type T
export function cache<T>(
  cb: Callback<T>,
  keyParts: string[],
  options: { revalidate?: number | false; tags?: string[] } = {}
): Callback<T> {
  // Return a function that caches using reactCache first and then nextCache with keyParts and options
  return nextCache(reactCache(cb), keyParts, options) as Callback<T>;
}



