"use client"

import { useState,useEffect } from "react";
import DVBDeviceBLE from "@/lib/DVBble";

export default function Firmware() {
    const [dvb] = useState(() => new DVBDeviceBLE());
    const [buttonLabel, setButtonLabel] = useState('Connect');

    useEffect(() => {
        const handleDisconnect = () => {
            setButtonLabel('Connect');
        }

        dvb.onDisconnect(handleDisconnect);
    },[dvb]);

    useEffect(() => {
        dvb.onConnect(()=>dvb.cmdImageState())
        dvb.onMessage((data:any)=>{
            console.log(data)
        })
    }, []);

    const connectDevice = async () => {
        if (buttonLabel === 'Connect') {
            toggleButton();
            await dvb.connect();
        } else {
            toggleButton();
            await dvb.disconnect();
        }
    }

    const toggleButton = () => {
        setButtonLabel(buttonLabel === "Connect" ? "Disconnect" : "Connect");
    }

    return  <div className="">
                <h1 className="text-2xl">Firmware</h1>
        <button onClick={connectDevice} className={`border-4  border-black p-2 rounded-md bg-slate-800 text-white my-2 w-40 ${buttonLabel === "Disconnect" ? "bg-red-500 border-red-500" : ""}`}>
            {buttonLabel}
        </button>
            </div>
}