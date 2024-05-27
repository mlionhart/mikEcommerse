import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import db from "@/db/db";
import { cache } from "@/lib/cache";
import { Suspense } from "react";

const getProducts = cache(() => {
  return db.product.findMany({
    where: {
      isAvailableForPurchase: true,
    },
    orderBy: {
      name: "asc"
    },
  });
}, ["/products", "getProducts"])

export default function ProductsPage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Suspense is a React component that lets you "wait" for some code to load and specify a loading state (like a loading spinner or skeleton). Here, Suspense is wrapping the ProductsSuspense component, so it will show the fallback below while it's waiting for ProductsSuspense to load */}
      <Suspense
        fallback={
          <>
            <ProductCardSkeleton />
            <ProductCardSkeleton />
            <ProductCardSkeleton />
            <ProductCardSkeleton />
            <ProductCardSkeleton />
            <ProductCardSkeleton />
          </>
        }
      >
        <ProductsSuspense />
      </Suspense>
    </div>
  );
}

async function ProductsSuspense() {
  const products =  await getProducts();
  return products.map(product => (
    <ProductCard key={product.id} {...product} />
  ))
}
