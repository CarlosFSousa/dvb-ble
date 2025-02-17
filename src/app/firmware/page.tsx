"use client"

import {useEffect, useState} from "react";
import DVBDeviceBLE from "@/lib/DVBble";


export default function Firmware() {
    const [shortname,setShortname] = useState("");

    useEffect(() => {
        const dvb = new DVBDeviceBLE();
        console.log(dvb)
    }, []);

    const connectDevice = async () => {
        const dvb = new DVBDeviceBLE();
        await dvb.connect();
    }

    return <div>
        <button onClick={connectDevice} className="border-4 border-black p-2 rounded-md bg-slate-800 text-white m-2">
            Connect
        </button>
        <h1>File Transfer</h1>
        <table className="table-auto w-full border-collapse border border-gray-500">
            <thead className="bg-gray-100">
                <tr>
                    <th className="px-4 py-2 border-b border-gray-300 border-r">Name</th>
                    <th className="px-4 py-2 border-b border-gray-300 border-r">Length</th>
                    <th className="px-4 py-2 border-b border-gray-300">Actions</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        </table>
    </div>
}