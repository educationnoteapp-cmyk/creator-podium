"use client";

// KingSpot.tsx — The #1 throne display.
//
// Shows the King's avatar with a Lottie animated crown above it.
// During the crowning ceremony (`intense` prop), the gold glow
// amplifies to a blinding spotlight effect.

import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { motion } from "framer-motion";
import RollingNumber from "./RollingNumber";

interface KingSpotProps {
  avatarUrl: string;
  fanHandle: string;
  /** Amount in cents — displayed with rolling odometer animation */
  amountPaid: number;
  /** True during the 1.5s crowning ceremony — boosts glow intensity */
  intense?: boolean;
}

export default function KingSpot({
  avatarUrl,
  fanHandle,
  amountPaid,
  intense = false,
}: KingSpotProps) {
  return (
    <div className="relative flex flex-col items-center">
      <div className="relative w-24 h-24">
        {/* Avatar with reactive gold glow */}
        <motion.img
          src={avatarUrl || undefined}
          alt={fanHandle}
          className="w-24 h-24 rounded-full border-4 border-yellow-400 object-cover"
          animate={{
            boxShadow: intense
              ? [
                  "0 0 40px rgba(255,215,0,0.9), 0 0 80px rgba(255,215,0,0.7), 0 0 120px rgba(255,180,0,0.5)",
                  "0 0 60px rgba(255,215,0,1),   0 0 120px rgba(255,215,0,0.8), 0 0 180px rgba(255,180,0,0.6)",
                  "0 0 40px rgba(255,215,0,0.9), 0 0 80px rgba(255,215,0,0.7), 0 0 120px rgba(255,180,0,0.5)",
                ]
              : "0 0 25px rgba(255,215,0,0.8)",
          }}
          transition={
            intense
              ? { duration: 0.7, repeat: Infinity, ease: "easeInOut" }
              : { duration: 0.4 }
          }
        />

        {/* Lottie crown — positioned above the avatar */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-20 h-20 pointer-events-none">
          <DotLottieReact
            src="/crown.lottie"
            loop
            autoplay
            style={{ background: "transparent" }}
          />
        </div>
      </div>

      {/* Handle */}
      <p className="mt-4 text-yellow-400 font-bold text-lg">@{fanHandle}</p>

      {/* Amount — rolling odometer */}
      <RollingNumber
        value={amountPaid}
        className="text-yellow-500/80 text-xs font-bold tracking-[0.2em] mt-0.5"
      />
    </div>
  );
}
