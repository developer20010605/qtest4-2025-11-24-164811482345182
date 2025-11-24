// frontend/src/hooks/useActor.ts
import { useEffect, useState } from "react";
import type { ActorSubclass } from "@dfinity/agent";
// dfx generate backend → /src/declarations/backend
// Frontend-ээс харгалзах зам: ../../../src/declarations/backend
import { backend } from "../../../src/declarations/backend";

export type BackendActor = typeof backend extends ActorSubclass<infer T>
  ? ActorSubclass<T>
  : typeof backend;

export function useActor() {
  const [actor, setActor] = useState<BackendActor | null>(null);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    // Энд Internet Identity-г ашиглаж advance actor үүсгэж болно,
    // одоохондоо dfx-ийн default actor-г шууд хэрэглэж байна.
    setActor(backend as BackendActor);
    setIsFetching(false);
  }, []);

  return { actor, isFetching };
}
