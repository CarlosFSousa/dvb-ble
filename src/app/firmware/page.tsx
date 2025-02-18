"use client"

import { useEffect, useState } from "react";
import DVBDeviceBLE from "@/lib/DVBble";


export default function Firmware() {
  const [shortname, setShortname] = useState("");
  const [tableRows, setTableRows] = useState([
    { name: "test", length: "test", actions: "test" }
  ]);

  useEffect(() => {
    const dvb = new DVBDeviceBLE();
    console.log(dvb)
  }, []);

  const connectDevice = async () => {
    const dvb = new DVBDeviceBLE();
    await dvb.connect();
  }

  const clearTable = () => {
    setTableRows([]);
  };

  return <div>
    <button onClick={connectDevice} className="border-4 border-black p-2 rounded-md bg-slate-800 text-white m-2">
      Connect
    </button>
    <h1>File Transfer</h1>
    <button
        onClick={clearTable}
        className="border-4 border-red-500 p-2 rounded-md bg-red-600 text-white m-2"
      ></button>
    <table className="table-auto w-full border-collapse border border-gray-500">
      <thead className="bg-gray-100">
        <tr>
          <th className="px-4 py-2 border-b border-gray-300 border-r">Name</th>
          <th className="px-4 py-2 border-b border-gray-300 border-r">Length</th>
          <th className="px-4 py-2 border-b border-gray-300">Actions</th>
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
            tableRows.map((row, index) => (
              <tr key={index}>
                <td className="px-4 py-2 border-b border-gray-300 border-r">{row.name}</td>
                <td className="px-4 py-2 border-b border-gray-300 border-r">{row.length}</td>
                <td className="px-4 py-2 border-b border-gray-300">{row.actions}</td>
              </tr>
            ))
          )} 
      </tbody>
    </table>
  </div>
}
