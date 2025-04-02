"use client";

import { useEffect, useState, useRef } from "react";
import DVBDeviceBLE from "@/lib/DVBble";

interface McuImage {
  slot: number;
  active: boolean;
  version: string;
  bootable: boolean;
  pending: boolean;
  hash: number[];
  confirmed: boolean;
}

interface McuImageInfo {
  version: string;
  hash: Uint8Array;
}

export default function Firmware() {
  const mcumgrRef = useRef(new DVBDeviceBLE());
  const [showConnecting, setShowConnecting] = useState(false);
  const [showConnected, setShowConnected] = useState(false);
  const [images, setImages] = useState<McuImage[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
  const [status, setStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onSelectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    console.log(`Selected file: ${selectedFile.name}`);
    
    const reader = new FileReader();
    reader.readAsArrayBuffer(selectedFile);
    reader.onload = async () => {
      if (reader.result) {
        const buf = reader.result as ArrayBuffer;
        setFileData(buf);
        try {
          const info: McuImageInfo = await mcumgrRef.current.imageInfo(buf);
          console.log(`Ready to upload: v${info.version}, ${buf.byteLength} bytes`);
        } catch (error: unknown) {
          console.error(error);
        }
      }
    };
  };

  const handleUpload = async () => {
    if (!file || !fileData) {
      console.log("No file selected for upload");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setStatus("Starting upload...");
    console.log("Starting firmware upload...");
    console.log(`File size: ${fileData.byteLength} bytes`);

    try {
      // Upload to slot 1 (standby)
      console.log("Initiating upload command to slot 1...");
      await mcumgrRef.current.cmdUpload(new Uint8Array(fileData), 1);
      console.log("Upload command sent successfully");
      
      // Wait for upload to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Only erase the standby slot after successful upload
      console.log("Upload successful, erasing standby slot...");
      await mcumgrRef.current.cmdImageErase();
      setStatus("Upload complete, erased standby slot");
      
    } catch (error: unknown) {
      console.error(`Upload failed: ${error instanceof Error ? error.message : String(error)}`);
      setStatus(`Upload failed: ${error instanceof Error ? error.message : String(error)}`);
      setIsUploading(false);
    }
  };

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

  useEffect(() => {
    const mgr = mcumgrRef.current;

    mgr.onConnecting(() => {
      setShowConnecting(true);
      setShowConnected(false);
      console.log("Connecting to device...");
    });

    mgr.onConnect(() => {
      setShowConnecting(false);
      setShowConnected(true);
      console.log("Device connected");
      mgr.cmdImageState();
    });

    mgr.onDisconnect(() => {
      setShowConnecting(false);
      setShowConnected(false);
      console.log("Device disconnected");
    });

    mgr.onMessage((message: { op: number; group: number; id: number; data: unknown; length: number }) => {
      const { op, group, id, data, length } = message;
      console.log(`Received message - op: ${op}, group: ${group}, id: ${id}, length: ${length}`);
      console.log("Message data:", data);
      
      // Type assertion for data since we know the structure based on the context
      const typedData = data as {
        r?: string;
        tasks?: unknown[];
        images?: McuImage[];
        rc?: number;
        off?: number;
      };
      
      switch (group) {
        case 0:
          if (id === 0 && typedData.r !== undefined) {
            console.log(`Response received: ${typedData.r}`);
          } else if (id === 2 && typedData.tasks) {
            console.table(typedData.tasks);
          }
          break;
        case 1:
          if (id === 0 && typedData.images) {
            setImages(typedData.images);
            console.log("Firmware image information updated");
            console.table(typedData.images);
          } else if (id === 1 && typedData.off !== undefined) {
            console.log(`Upload offset updated: ${typedData.off}`);
          }
          break;
        default:
          break;
      }
    });

    mgr.onImageUploadProgress(({ percentage }: { percentage: number }) => {
      console.log(`Upload progress: ${percentage}%`);
      setUploadProgress(percentage);
      setStatus(`Uploading... ${percentage}%`);
    });

    mgr.onImageUploadFinished(() => {
      console.log("Upload complete");
      setFile(null);
      setFileData(null);
      setUploadProgress(0);
      mgr.cmdImageState();
      setIsUploading(false);
    });
  }, []);

  return (
    <section>
      <h1 className="text-2xl font-bold mb-4">Firmware Management</h1>
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
                    className={`p-4 rounded-md border ${image.active
                        ? "border-green-500 bg-green-50"
                        : "border-gray-300"
                      }`}
                  >
                    <h3 className="font-bold text-lg mb-2">
                      Slot #{image.slot}{" "}
                      {image.active ? "(Active)" : "(Standby)"}
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
                          <td className="font-medium py-1">Confirmed:</td>
                          <td>{image.confirmed ? "Yes" : "No"}</td>
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
                  mcumgrRef.current.cmdImageTest(new Uint8Array(images[1].hash));
                  console.log("Image marked for testing on next boot");
                }
              }}
              className={`px-3 py-1.5 ${!images[1] || images[1]?.pending
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
                if (images[0] && images[0].confirmed === false) {
                  mcumgrRef.current.cmdImageConfirm(new Uint8Array(images[0].hash));
                  console.log("Image confirmed");
                }
              }}
              className={`px-3 py-1.5 ${!images[0] || images[0]?.confirmed
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-green-100 hover:bg-green-200 text-green-800"
                } rounded-md transition-colors`}
              disabled={!images[0] || images[0]?.confirmed}
              title="Confirm active image"
            >
              Confirm
            </button>
            <button
              onClick={() => {
                mcumgrRef.current.cmdReset();
                console.log("Device reset command sent");
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
                  Select Firmware Image (.bin)
                </label>
                <input
                  type="file"
                  onChange={onSelectFile}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  accept=".bin"
                  disabled={isUploading}
                />
              </div>

              {isUploading ? (
                <div className="text-sm text-gray-600">{status}</div>
              ) : null}

              {isUploading && (
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              )}

              <button
                onClick={handleUpload}
                className={`px-4 py-2 rounded-md font-medium ${!fileData || isUploading
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
                  } transition-colors`}
                disabled={!fileData || isUploading}
              >
                {isUploading
                  ? `Uploading (${uploadProgress}%)`
                  : "Upload Firmware"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
