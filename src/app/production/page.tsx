"use client"

import React, { useState, useEffect,useRef } from "react";
import DVBDeviceBLE from "@/lib/DVBble";

export default function Production() {
    const mcumgrRef = useRef(new DVBDeviceBLE());
    const [showConnected, setShowConnected] = useState(false);
    const [showConnecting, setShowConnecting] = useState(false);

    const connectDevice = async () => {
        if (!showConnected && !showConnecting) {
          setShowConnecting(true);
          try {
            console.log("Connecting to device...");
            await mcumgrRef.current.connect();
          } catch (error: unknown) {
            console.error(`Connection failed: ${error instanceof Error ? error.message : String(error)}`);
            setShowConnecting(false);
          }
        } else {
          try {
            console.log("Disconnecting from device...");
            await mcumgrRef.current.disconnect();
          } catch (error: unknown) {
            console.error(`Disconnect failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      };
      
    return (
        <section>
            <h1>Production</h1>
        </section>
    )
}
