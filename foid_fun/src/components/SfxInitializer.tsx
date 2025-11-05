'use client';

import { useEffect } from "react";
import sfx from "@/lib/sfx";

export default function SfxInitializer() {
  useEffect(() => {
    void sfx.init();
  }, []);

  return null;
}
