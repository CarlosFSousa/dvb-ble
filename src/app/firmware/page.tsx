"use client"

import { useEffect, useState } from "react";
import DVBDeviceBLE from "@/lib/DVBble";

interface TableRow {
  name: string;
  length: number;
  actions: any;
}

export default function Firmware() {
  const [dvb] = useState(() => new DVBDeviceBLE());
  const [shortname, setShortname] = useState("");
  const [serial, setSerial] = useState("");
  const [duDeviceUID, setDuDeviceUID] = useState("");
  const [firmware, setFirmware] = useState("");
  const [hardware, setHardware] = useState("");
  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [buttonLabel, setButtonLabel] = useState('Connect');

  useEffect(() => {
    dvb.onDisconnect(() => {
        setButtonLabel('Connect');
        clearTable();
    });
  }, []);

  const connectDevice = async () => {
    console.log(buttonLabel)
    if(buttonLabel === "Connect") {
      toggleButton();
      await dvb.connect();
      updateTable();
    } else {
      toggleButton();
      await dvb.disconnect();
      clearTable();
    }
  }

  const clearTable = () => {
    setTableRows([]);
  };

  const toggleButton = () => {
    setButtonLabel(buttonLabel === "Connect" ? "Disconnect" : "Connect");
  }

  const updateTable = async () => {

    const files = await dvb.getFileList();
    console.log(files)
    const newRows = files.map((file:TableRow) => {
      const buttonDowload = (
        <button
          onClick={() => downloadFile(file.name)}
          className="border-4 border-green-500 p-2 rounded-md bg-green-600 text-white m-2"
        >
          Download
        </button>
      );
      return {
        name: file.name,
        length: file.length,
        actions: buttonDowload
      } as TableRow;
    })
    
    setTableRows(newRows);

  }

  const downloadFile = async (name: string) => {
    const content = await dvb.getFileContent(name,()=>{});
    console.log(content);
  }

  return <div className="flex flex-col">
    <div className="flex flex-col items-baseline">
    <h1 className="text-2xl">File Transfer</h1>
    <button onClick={connectDevice} className={`border-4  border-black p-2 rounded-md bg-slate-800 text-white m-2 ${buttonLabel === "Disconnect" ? "bg-red-500 border-red-500" : ""}`}>
      {buttonLabel}
    </button>
      {buttonLabel === "Disconnect" && tableRows.length > 0 ? (
          <div className="flex-col flex items-baseline">
            <label className="text-xl">Change Shortname</label>
            <input className="border-2 border-black p-1"/>
            <button className="border-4 p-2 rounded-md bg-yellow-500 text-white m-2">Format Device</button>
          </div>
      ) : null
      }
    {/*<div className={`${buttonLabel === "Disconnect" && tableRows.length > 0 ? "" : "hidden"} flex-col flex items-baseline`}>*/}
    {/*  <label className="text-xl">Change Shortname</label>*/}
    {/*  <input className="border-2 border-black p-1"/>*/}
    {/*<button className="border-4 p-2 rounded-md bg-yellow-500 text-white m-2">Format Device</button>*/}
    {/*</div>*/}
    </div>
    <table className="table-auto w-full border-collapse border border-gray-500">
      <thead className="bg-gray-100">
        <tr>
          <th className="px-3 py-1 border-b border-gray-300 border-r">Name</th>
          <th className="px-3 py-1 border-b border-gray-300 border-r">Length</th>
          <th className="px-3 py-1 border-b border-gray-300">Actions</th>
        </tr>
      </thead>
      <tbody>
        {tableRows.length === 0 ? (
          <tr>
            <td colSpan={3} className="text-center py-4 text-gray-500">
              No data available
            </td>
          </tr>
        ) : (
          tableRows.map((row: TableRow, index) => (
            <tr key={index}>
              <td className="px-4 py-2 border-b border-gray-300 border-r text-center">{row.name}</td>
              <td className="px-4 py-2 border-b border-gray-300 border-r text-center">{row.length}</td>
              <td className="px-4 py-2 border-b border-gray-300 text-center">{row.actions}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
}
