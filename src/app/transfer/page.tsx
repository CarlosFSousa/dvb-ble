"use client"

import { useEffect, useState } from "react";
import DVBDeviceBLE from "@/lib/DVBble";

interface TableRow {
  name: string;
  length: number;
  actions: any;
}

export default function Transfer() {
  const [dvb] = useState(() => new DVBDeviceBLE());
  const [deviceName, setDeviceName] = useState("");
  const [shortname, setShortname] = useState("");
  const [newShortname, setNewShortname] = useState("");
  const [serial, setSerial] = useState("");
  const [duDeviceUID, setDuDeviceUID] = useState("");
  const [firmware, setFirmware] = useState("");
  const [hardware, setHardware] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileData, setFileData] = useState<Uint8Array | any>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showConnected, setShowConnected] = useState(false);
  const [showConnecting, setShowConnecting] = useState(false);
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
      setShowConnected(false);
      setShowConnecting(false);
      clearTable();
    }

    dvb.onDisconnect(handleDisconnect);

    dvb.onConnecting && dvb.onConnecting(() => {
      setShowConnecting(true);
      setShowConnected(false);
    });
    
    dvb.onConnect && dvb.onConnect(() => {
      setShowConnecting(false);
      setShowConnected(true);
    });

  }, [dvb]);

  useEffect(() => {
    setCurrentPage(1);
  }, [tableRows]);

  const connectDevice = async () => {
    if (!showConnected && !showConnecting) {
      setShowConnecting(true);
      try {
        await dvb.connect();
        await dvb.setDeviceInfo();
        setDeviceName(dvb.getDeviceName());
        setFirmware(dvb.getFirmwareVersion());
        setHardware(dvb.getHardwareVersion());
        setShortname(dvb.getShortName());
        setSerial(dvb.getSerialNumber());
        setDuDeviceUID(dvb.getDUDeviceUID());
        await updateTable();
      } catch (error) {
        console.error('Connection error:', error);
        setShowConnecting(false);
      }
    } else {
      try {
        await dvb.disconnect();
        clearTable();
      } catch (error) {
        console.error('Disconnection error:', error);
      }
    }
  }

  const clearTable = () => {
    setTableRows([]);
  };

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

  return <div className="p-4 max-w-4xl mx-auto">
  <div className="flex flex-col">
    <h1 className="text-2xl font-bold mb-4">File Transfer</h1>
    <button 
  onClick={connectDevice} 
  className={`px-4 py-2 rounded-md font-medium mb-4 w-40 ${
    showConnected
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
    {showConnected && tableRows.length > 0 ? (
  <div className="flex flex-col md:flex-row md:justify-between px-2 gap-4 mb-4">
    <div>
      <h1 className="text-2xl">{deviceName}</h1>
      <p>Shortname: {shortname}</p>
      <p>Serial Number: {serial}</p>
      <p>DU Device UID: {duDeviceUID}</p>
      <p>Hardware: {hardware}</p>
      <p>Firmware: {firmware}</p>
    </div>
    <div className="flex flex-col mt-4 md:mt-0">
      <label className="text-xl mb-1">Change Shortname</label>
      <input 
        className="border-2 border-gray-300 p-2 rounded-md mb-2" 
        placeholder="Enter new shortname"
        onChange={(e) => setNewShortname(e.target.value)} 
        onKeyDown={async (e) => {
          if (e.key === "Enter") {
            changeShortname(newShortname);
          }
        }} 
      />
      <button 
        className="p-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white transition-colors"
        onClick={formatStorage}
      >
        Format Device
      </button>
    </div>
  </div>
) : null}
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
