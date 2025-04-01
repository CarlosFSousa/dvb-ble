"use client"

import React, { useState, useEffect,useRef, use } from "react";
import DVBDeviceBLE from "@/lib/DVBble";

export default function Production() {
    const dvbDevice = useRef(new DVBDeviceBLE());
    const [showConnected, setShowConnected] = useState(false);
    const [showConnecting, setShowConnecting] = useState(false);

    const connectDevice = async () => {
        if (!showConnected && !showConnecting) {
          setShowConnecting(true);
          try {
            console.log("Connecting to device...");
            await dvbDevice.current.connect();
          } catch (error: unknown) {
            console.error(`Connection failed: ${error instanceof Error ? error.message : String(error)}`);
            setShowConnecting(false);
          }
        } else {
          try {
            console.log("Disconnecting from device...");
            await dvbDevice.current.disconnect();
          } catch (error: unknown) {
            console.error(`Disconnect failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      };

      useEffect(() => {
        const dvb = dvbDevice.current;

        dvb.onConnecting(() => {
            setShowConnecting(true);
            setShowConnected(false);
            console.log("Connecting to device...");
        });

        dvb.onConnect(() => {
            setShowConnecting(false);
            setShowConnected(true);
            console.log("Connected to device");
            console.log(dvb)
        });

        dvb.onDisconnect(() => {
            setShowConnecting(false);
            setShowConnected(false);
            console.log("Disconnected from device");
        });

      }),[]

    return (
        <section>
            <h1 className="text-2xl font-bold mb-4">Production</h1>
      <button
        onClick={connectDevice}
        className={`px-4 py-2 rounded-md font-medium mb-4 w-40 ${showConnected
            ? "bg-red-500 hover:bg-red-600 text-white"
            : showConnecting
              ? "bg-yellow-500 text-white"
              : "bg-slate-800 hover:bg-slate-900 text-white"
          } transition-colors`}
        disabled={showConnecting}
      >
        {showConnected
          ? "Disconnect"
          : showConnecting
            ? "Connecting..."
            : "Connect"}
      </button>
        </section>
    )
}
