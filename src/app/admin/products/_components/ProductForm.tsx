"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { useState } from "react";
import { addProduct, updateProduct } from "../../_actions/products";
import { useFormStatus } from "react-dom";
import { Product } from "@prisma/client";
import Image from "next/image";

// Define the error type based on your form validation schema
interface FormErrors {
  name?: string;
  priceInCents?: string;
  description?: string;
  file?: string;
  image?: string;
}

export function ProductForm({ product }: { product?: Product | null }) {
  const [errors, setErrors] = useState<FormErrors>({});
  const [priceInCents, setPriceInCents] = useState<number | undefined>(
    product?.priceInCents
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      if (product == null) {
        await addProduct(undefined, formData);
      } else {
        await updateProduct(product.id, undefined, formData);
      }
      setErrors({});
      // handle successful form submission, e.g., redirect or show a success message
    } catch (err) {
      setErrors(err as FormErrors);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          type="text"
          id="name"
          name="name"
          required
          defaultValue={product?.name || ""}
        />
        {errors.name && <div className="text-destructive">{errors.name}</div>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="priceInCents">Price in Cents</Label>
        <Input
          type="number"
          id="priceInCents"
          name="priceInCents"
          required
          value={priceInCents}
          onChange={(e) => setPriceInCents(Number(e.target.value) || undefined)}
        />
        <div className="text-muted-foreground">
          {formatCurrency((priceInCents || 0) / 100)}
        </div>
        {errors.priceInCents && (
          <div className="text-destructive">{errors.priceInCents}</div>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          required
          defaultValue={product?.description || ""}
        />
        {errors.description && (
          <div className="text-destructive">{errors.description}</div>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="file">File</Label>
        <Input type="file" id="file" name="file" required={product == null} />
        {/* show file info */}
        {product != null && (
          <div className="text-muted-foreground">{product.filePath}</div>
        )}
        {errors.file && <div className="text-destructive">{errors.file}</div>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="image">Image</Label>
        <Input type="file" id="image" name="image" required={product == null} />
        {/* show image */}
        {product != null && (
          <Image
            src={product.imagePath}
            height="400"
            width="400"
            alt="Product Image"
          />
        )}
        {errors.image && <div className="text-destructive">{errors.image}</div>}
      </div>
      <SubmitButton />
    </form>
  );
}

// reason we're putting submit into it's own function is so we can use useFormStatus() and pending state - which makes it so form is disabled if in the process of saving
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save"}
    </Button>
  );
}
