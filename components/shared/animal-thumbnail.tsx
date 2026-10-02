"use client";

import { useEffect, useState } from "react";
import { PlaceholderThumbnail } from "@/components/shared/placeholder-thumbnail";
import { getPrimaryPhoto } from "@/lib/photos/store";

// For card-style list rows (Application/Agreement/Animal/Meet and
// Greet/Intake Record cards) that only have an animalId, not an
// already-fetched Photo - looks up that animal's public listing photo
// (FR-AN-02) itself and renders the real image, falling back to
// PlaceholderThumbnail's placeholder graphic if none is set yet. When a
// screen already has the relevant Photo in hand (e.g. the Animal
// Profile header, or the Photos tab's own list), pass photoSrc to
// PlaceholderThumbnail directly instead of using this wrapper - no need
// for a second fetch of data the screen already loaded.
export function AnimalThumbnail({
  animalId,
  species,
  className,
}: {
  animalId: string;
  species: string;
  className?: string;
}) {
  const [photo, setPhoto] = useState<{ src?: string; altText?: string } | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getPrimaryPhoto(animalId).then((result) => {
      if (!cancelled) setPhoto({ src: result?.imageUrl, altText: result?.altText });
    });
    return () => {
      cancelled = true;
    };
  }, [animalId]);

  return (
    <PlaceholderThumbnail
      species={species}
      altText={photo?.altText}
      photoSrc={photo?.src}
      className={className}
    />
  );
}
