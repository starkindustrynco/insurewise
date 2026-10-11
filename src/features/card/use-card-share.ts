"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cardText, encodeCard, type CardData } from "@/domain/card";

/** The hospital link, share text and copy action for a card. Shared by the card page and the side panel. */
export function useCardShare(card: CardData | null) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const link = card && origin ? `${origin}/hospital?c=${encodeCard(card)}` : "";
  const text = card ? cardText(card, link || undefined) : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Card copied");
    } catch {
      toast.error("Couldn't copy. Select the text instead.");
    }
  };

  return { link, text, copy, whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}` };
}
