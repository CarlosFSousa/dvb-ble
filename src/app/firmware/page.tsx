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
  const [deviceName, setDeviceName] = useState("");
  const [shortname, setShortname] = useState("");
  const [newShortname, setNewShortname] = useState("");
  const [serial, setSerial] = useState("");
  const [duDeviceUID, setDuDeviceUID] = useState("");
  const [firmware, setFirmware] = useState("");
  const [hardware, setHardware] = useState("");
  const [buttonLabel, setButtonLabel] = useState('Connect');
  const [showModal, setShowModal] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileData, setFileData] = useState<Uint8Array | any>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const indexOfLastRow = currentPage * itemsPerPage;
  const indexOfFirstRow = indexOfLastRow - itemsPerPage;
  const currentRows = tableRows.slice(indexOfFirstRow, indexOfLastRow);

  const nextPage = () => {
    if (indexOfLastRow < tableRows.length) {
      setCurrentPage(currentPage + 1);
    }
  }

  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  }

  useEffect(() => {
    const handleDisconnect = () => {
      setButtonLabel('Connect');
      clearTable();
    }

    dvb.onDisconnect(handleDisconnect);

  }, [dvb]);

  useEffect(() => {
    setCurrentPage(1);
  }, [tableRows]);

  const connectDevice = async () => {
    console.log(buttonLabel)
    if (buttonLabel === "Connect") {
      toggleButton();
      await dvb.connect();
      setDeviceName(dvb.getDeviceName());
      setFirmware(dvb.getFirmwareVersion());
      setHardware(dvb.getHardwareVersion());
      setShortname(dvb.getShortName());
      setSerial(dvb.getSerialNumber());
      setDuDeviceUID(dvb.getDUDeviceUID());
      await updateTable();
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
    const newRows = files.map((file: TableRow) => {
      const buttonDownload = (
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
        actions: buttonDownload
      } as TableRow;
    })

    setTableRows(newRows);

  }

  const downloadFile = async (name: string) => {
    setFileName(name);
    setShowModal(true);
    setDownloadProgress(0);
    const content = await dvb.getFileContent(name, (progress: number) => {
      setDownloadProgress(progress);
    });
    setFileData(content);
    setDownloadProgress(100);
  }

  const saveFile = (name: string) => {
    const file = new Blob([fileData]);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(file);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const formatStorage = async () => {
    if (confirm('Are you sure you want to format the device?')) {
      try {
        await dvb.formatStorage();
        alert('Device formatted');
        dvb.disconnect();
      } catch (error) {
        alert('There was an error formatting your device.');
        console.error('Format error:', error);
      }
    }
  };

  const changeShortname = async (value: string) => {
    try {
      await dvb.setShortName(value);
      await dvb.disconnect();
    } catch (error) {
      console.log("Error changing shortname", error);
    }
  }

  return <div className="flex flex-col">
    <div className="flex flex-col">
      <h1 className="text-2xl">File Transfer</h1>
      <button onClick={connectDevice} className={`border-4  border-black p-2 rounded-md bg-slate-800 text-white my-2 w-40 ${buttonLabel === "Disconnect" ? "bg-red-500 border-red-500" : ""}`}>
        {buttonLabel}
      </button>
      {buttonLabel === "Disconnect" && tableRows.length > 0 ? (
        <div className="flex justify-between px-2">
          <div>
            <h1 className="text-2xl">{deviceName}</h1>
            <p>Shortname: {shortname}</p>
            <p>Serial Number: {serial}</p>
            <p>DU Device UID: {duDeviceUID}</p>
            <p>Hardware: {hardware}</p>
            <p>Firmware: {firmware}</p>
          </div>
          <div className="flex flex-col">
            <label className="text-xl">Change Shortname</label>
            <input className="border-2 border-black p-1 " onChange={(e) => setNewShortname(e.target.value)} onKeyDown={async (e) => {
              if (e.key === "Enter") {
                changeShortname(newShortname);
              }
            }} />
            <button className="border-4 p-2 rounded-md bg-yellow-500 text-white mt-2 w-full" onClick={formatStorage}>
              Format Device
            </button>
          </div>
        </div>
      ) : null
      }
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
        {currentRows.length === 0 ? (
          <tr>
            <td colSpan={3} className="text-center py-4 text-gray-500">
              No data available
            </td>
          </tr>
        ) : (
          currentRows.map((row: TableRow, index) => (
            <tr key={index}>
              <td className="px-4 py-2 border-b border-gray-300 border-r text-center">{row.name}</td>
              <td className="px-4 py-2 border-b border-gray-300 border-r text-center">{row.length}</td>
              <td className="px-4 py-2 border-b border-gray-300 text-center">{row.actions}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
    {tableRows.length > 0 && (
    <div className="flex justify-between my-4">
      <button
        onClick={prevPage}
        disabled={currentPage === 1}
        className="border p-2 rounded-md bg-gray-300 disabled:opacity-50"
      >
        Prev
      </button>
      <span className="self-center">
        Page {currentPage} of {Math.ceil(tableRows.length / itemsPerPage)}
      </span>
      <button
        onClick={nextPage}
        disabled={indexOfLastRow >= tableRows.length}
        className="border p-2 rounded-md bg-gray-300 disabled:opacity-50"
      >
        Next
      </button>
    </div>
   ) }
    {showModal && (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white p-4 w-3/4">
          <h2 className="text-xl">File Content</h2>
          {downloadProgress < 100 ? (
            <div className="flex flex-col items-center">
              <progress value={downloadProgress} max="100" className="w-full" />
              <span>{downloadProgress}%</span>
            </div>
          ) : (
            <textarea
              readOnly
              className="border w-full h-64 p-2"
              value={fileData ? fileData.toString() : ''}
            />
          )}
          <button onClick={() => setShowModal(false)}
            className="border p-2 mt-2">Close
          </button>
          {downloadProgress === 100 && (
            <button onClick={() => saveFile(fileName)} className="border p-2 mt-2">
              Download
            </button>
          )}
        </div>
      </div>
    )}
  </div>
}
