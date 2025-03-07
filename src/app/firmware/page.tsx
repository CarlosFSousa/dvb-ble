"use client";

import { useState, useEffect } from "react";
import DVBDeviceBLE from "@/lib/DVBble";

type DeviceInfo = {
    op: number;
    group: number;
    id: number;
    data: any;
    length: number;
};

export default function Firmware() {
    const [dvb] = useState(() => new DVBDeviceBLE());
    const [buttonLabel, setButtonLabel] = useState("Connect");
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
        op: 0,
        group: 0,
        id: 0,
        data: {},
        length: 0,
    });

    useEffect(() => {
        const handleDisconnect = () => {
            setButtonLabel("Connect");
        };

        dvb.onConnect(() => dvb.cmdImageState());
        dvb.onDisconnect(handleDisconnect);
        dvb.onMessage(({ op, group,id, data,length }: any) => {
            switch (group) {
                case 0:
                    switch(id){
                        case 0:
                            alert(data.r)
                            break;
                        case 1:
                            console.table(data.tasks)
                            break;
                        case 2:
                            console.log(data)
                            break;
                    }
                break;
                case 1:
                    switch(id){
                        case 0:
                            setDeviceInfo({
                                op,
                                group,
                                id,
                                data,
                                length
                            });
                            break;
                    }
                break;
                default:
                    console.log("Unknown group");
            }
            console.log(`Received message: ${op} ${group} ${id} ${length}`);
        });
    }, []);

    const connectDevice = async () => {
        if (buttonLabel === "Connect") {
            toggleButton();
            await dvb.connect();
        } else {
            toggleButton();
            await dvb.disconnect();
        }
    };

    const toggleButton = () => {
        setButtonLabel(buttonLabel === "Connect" ? "Disconnect" : "Connect");
    };

    return (
        <div className="">
            <h1 className="text-2xl">Firmware</h1>
            <button
                onClick={connectDevice}
                className={`border-4  border-black p-2 rounded-md bg-slate-800 text-white my-2 w-40 ${buttonLabel === "Disconnect" ? "bg-red-500 border-red-500" : ""}`}
            >
                {buttonLabel}
            </button>
            <table className="table-auto w-full border-collapse border border-gray-500">
      <thead className="bg-gray-100">
        <tr>
          <th className="px-3 py-1 border-b border-gray-300 border-r">Name</th>
          <th className="px-3 py-1 border-b border-gray-300 border-r">Length</th>
          <th className="px-3 py-1 border-b border-gray-300">Actions</th>
        </tr>
      </thead>
      <tbody>
        {deviceInfo.data.images === 0 ? (
          <tr>
            <td colSpan={3} className="text-center py-4 text-gray-500">
              No data available
            </td>
          </tr>
        ) : 
        (
          deviceInfo.data.images.forEach((image: any) => {
            console.log(image)
            
            })
        )
        }
      </tbody>
    </table>
        </div>
    );
}
