"use client";

import { useEffect, useState, useRef } from "react";
import DVBDeviceBLE from "@/lib/DVBble";

interface McuMessage {
  op: number;
  group: number;
  id: number;
  data: any;
  length: number;
}

interface McuImage {
  slot: number;
  active: boolean;
  version: string;
  bootable: boolean;
  pending: boolean;
  hash: number[];
}

interface McuImageInfo {
  version: string;
  hash: string;
  imageSize: number;
}

export default function Firmware() {
  const mcumgrRef = useRef(new DVBDeviceBLE());
  const [showConnecting, setShowConnecting] = useState(false);
  const [showConnected, setShowConnected] = useState(false);
  const [images, setImages] = useState<McuImage[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [status, setStatus] = useState("Select image file (.img)");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onSelectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setStatus(`Selected: ${selectedFile.name}`);

    const reader = new FileReader();
    reader.readAsArrayBuffer(selectedFile);
    reader.onload = async () => {
      if (reader.result) {
        const buf = reader.result as ArrayBuffer;
        setFileData(buf);
        try {
          const info: McuImageInfo = await mcumgrRef.current.imageInfo(buf);
          setStatus(
            `Ready to upload (v${info.version}, ${buf.byteLength} bytes)`
          );
        } catch (error: any) {
          setStatus(`ERROR: ${error?.message}`);
        }
      }
    };
  };

  const handleUpload = async () => {
    if (!file || !fileData) {
      setStatus("Please select a file first");
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    setStatus("Starting upload...");
    
    try {
      mcumgrRef.current.cmdUpload(fileData);
    } catch (error: any) {
      setStatus(`Upload failed: ${error?.message}`);
      setIsUploading(false);
    }
  };

  const connectDevice = async () => {
    if (!showConnected && !showConnecting) {
      setShowConnecting(true);
      try {
        await mcumgrRef.current.connect();
      } catch (error: any) {
        setStatus(`Connection failed: ${error?.message}`);
        setShowConnecting(false);
      }
    } else {
      try {
        await mcumgrRef.current.disconnect();
      } catch (error: any) {
        setStatus(`Disconnect failed: ${error?.message}`);
      }
    }
  };

  useEffect(() => {
    const mgr = mcumgrRef.current;

    mgr.onConnecting(() => {
      setShowConnecting(true);
      setShowConnected(false);
      setStatus("Connecting to device...");
    });

    mgr.onConnect(() => {
      setShowConnecting(false);
      setShowConnected(true);
      setStatus("Device connected");
      mgr.cmdImageState();
    });

    mgr.onDisconnect(() => {
      setShowConnecting(false);
      setShowConnected(false);
      setStatus("Device disconnected");
    });

    mgr.onMessage(({ op, group, id, data, length }: McuMessage) => {
      switch (group) {
        case 0:
          if (id === 0 && data?.r !== undefined) {
            setStatus(`Response: ${data.r}`);
          } else if (id === 2 && data?.tasks) {
            console.table(data.tasks);
          }
          break;
        case 1:
          if (id === 0 && data.images) {
            setImages(data.images);
            setStatus("Firmware image information updated");
          }
          break;
        default:
          break;
      }
    });

    mgr.onImageUploadProgress(({ percentage }: { percentage: number }) => {
      setUploadProgress(percentage);
      setStatus(`Uploading... ${percentage}%`);
    });

    mgr.onImageUploadFinished(() => {
      setStatus("Upload complete");
      setFile(null);
      setFileData(null);
      setUploadProgress(0);
      mgr.cmdImageState();
      setIsUploading(false);
    });
  }, []);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Firmware Management</h1>
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

      {showConnected && (
        <div className="mt-6 border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
          <h2 className="text-xl font-semibold mb-3">Device Firmware</h2>
          
          {/* Images section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {images.length === 0 ? (
              <div className="col-span-full text-center py-8 bg-gray-50 rounded-md">
                No firmware images found on device
              </div>
            ) : (
              images.map((image, i) => {
                const hashStr = Array.from(image.hash || [])
                  .map((byte) => byte.toString(16).padStart(2, "0"))
                  .join("");
                return (
                  <div
                    key={i}
                    className={`p-4 rounded-md border ${
                      image.active
                        ? "border-green-500 bg-green-50"
                        : "border-gray-300"
                    }`}
                  >
                    <h3 className="font-bold text-lg mb-2">
                      Slot #{image.slot} {image.active ? "(Active)" : "(Standby)"}
                    </h3>
                    <table className="w-full text-sm">
                      <tbody>
                        <tr>
                          <td className="font-medium py-1">Version:</td>
                          <td>v{image.version}</td>
                        </tr>
                        <tr>
                          <td className="font-medium py-1">Bootable:</td>
                          <td>{image.bootable ? "Yes" : "No"}</td>
                        </tr>
                        <tr>
                          <td className="font-medium py-1">Pending:</td>
                          <td>{image.pending ? "Yes" : "No"}</td>
                        </tr>
                        <tr>
                          <td className="font-medium py-1">Hash:</td>
                          <td className="break-all text-xs">{hashStr}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })
            )}
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => mcumgrRef.current.cmdImageState()}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-md transition-colors"
              title="Refresh firmware information"
            >
              Refresh
            </button>
            <button
              onClick={() => mcumgrRef.current.cmdImageErase()}
              className="px-3 py-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded-md transition-colors"
              title="Erase standby firmware slot"
            >
              Erase
            </button>
            <button
              onClick={() => {
                if (images[1] && images[1].pending === false) {
                  mcumgrRef.current.cmdImageTest(images[1].hash);
                  setStatus("Image marked for testing on next boot");
                }
              }}
              className={`px-3 py-1.5 ${
                !images[1] || images[1]?.pending
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-100 hover:bg-blue-200 text-blue-800"
              } rounded-md transition-colors`}
              disabled={!images[1] || images[1]?.pending}
              title="Mark standby image to be tested on next boot"
            >
              Test Image
            </button>
            <button
              onClick={() => {
                mcumgrRef.current.cmdReset();
                setStatus("Device reset command sent");
              }}
              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-md transition-colors"
              title="Reset the device"
            >
              Reset Device
            </button>
          </div>
          
          {/* Upload section */}
          <div className="mt-8 border-t pt-4">
            <h2 className="text-xl font-semibold mb-3">Upload New Firmware</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Firmware Image (.img)
                </label>
                <input
                  type="file"
                  onChange={onSelectFile}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  accept=".img"
                  disabled={isUploading}
                />
              </div>
              
              <div className="text-sm text-gray-600">{status}</div>
              
              {isUploading && (
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{width: `${uploadProgress}%`}}
                  ></div>
                </div>
              )}
              
              <button
                onClick={handleUpload}
                className={`px-4 py-2 rounded-md font-medium ${
                  !fileData || isUploading
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
                } transition-colors`}
                disabled={!fileData || isUploading}
              >
                {isUploading ? `Uploading (${uploadProgress}%)` : "Upload Firmware"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}