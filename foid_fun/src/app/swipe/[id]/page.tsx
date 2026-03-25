"use client";

import { useParams } from "next/navigation";
import { redirect } from "next/navigation";
import { useEffect } from "react";

export default function SwipeIdRedirect() {
  const params = useParams();
  const id = params?.id;

  useEffect(() => {
    if (id) {
      window.location.href = `/vote/${id}`;
    }
  }, [id]);

  return null;
}
