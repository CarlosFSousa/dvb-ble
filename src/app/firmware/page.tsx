"use client";

import { useEffect, useState, useRef } from "react";
import DVBDeviceBLE from "@/lib/DVBble";

// Interfaces for type safety
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

  const onSelectFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);

    const reader = new FileReader();
    reader.readAsArrayBuffer(selectedFile);
    reader.onload = async () => {
      if (reader.result) {
        const buf = reader.result as ArrayBuffer;
        setFileData(buf);
        try {
          const info: McuImageInfo = await mcumgrRef.current.imageInfo(buf);
          setStatus(`Ready to upload (v${info.version}, ${buf.byteLength} bytes)`);
        } catch (error: any) {
          setStatus(`ERROR: ${error?.message}`);
        }
      }
    };
  };

  const handleUpload = async () => {
    if (!file || !fileData) return;
    setIsUploading(true);
    mcumgrRef.current.cmdUpload(fileData);
  };

  const connectDevice = async () => {
    if (!showConnected && !showConnecting) {
      setShowConnecting(true);
      await mcumgrRef.current.connect();
    } else {
      await mcumgrRef.current.disconnect();
    }
  };

  useEffect(() => {
    const mgr = mcumgrRef.current;

    mgr.onConnecting(() => {
      setShowConnecting(true);
      setShowConnected(false);
    });

    mgr.onConnect(() => {
      setShowConnecting(false);
      setShowConnected(true);
      mgr.cmdImageState();
    });

    mgr.onDisconnect(() => {
      setShowConnecting(false);
      setShowConnected(false);
    });

    mgr.onMessage(({ op, group, id, data, length }: McuMessage) => {
      switch (group) {
        case 0:
          if (id === 0 && data?.r !== undefined) {
            alert(data.r);
          } else if (id === 2 && data?.tasks) {
            console.table(data.tasks);
          }
          break;
        case 1:
          if (id === 0 && data.images) {
            setImages(data.images);
          }
          break;
        default:
          break;
      }
    });

    mgr.onImageUploadProgress(({ percentage }: { percentage: number }) => {
      setStatus(`Uploading... ${percentage}%`);
    });

    mgr.onImageUploadFinished(() => {
      setStatus("Upload complete");
      setFile(null);
      setFileData(null);
      mgr.cmdImageState();
      setIsUploading(false);
    });
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl mb-3">Firmware</h1>
      <button
        onClick={connectDevice}
        className={`border-4 border-black p-2 rounded-md my-2 w-40 ${
          showConnected
            ? "bg-red-500 border-red-500 text-white"
            : "bg-slate-800 text-white"
        }`}
      >
        {showConnected ? "Disconnect" : showConnecting ? "Connecting..." : "Connect"}
      </button>

      {showConnected && (
        <div className="my-3">
          <hr />
          <h3>Images</h3>
          <div className="flex flex-wrap mb-3">
            {images.map((image, i) => {
              const hashStr = Array.from(image.hash || [])
                .map((byte) => byte.toString(16).padStart(2, "0"))
                .join("");
              return (
                <div
                  key={i}
                  className={`p-3 m-2 border ${
                    image.active ? "border-green-500 bg-green-50" : "border-gray-300"
                  }`}
                >
                  <h4>
                    Slot #{image.slot} {image.active ? "active" : "standby"}
                  </h4>
                  <table>
                    <tbody>
                      <tr>
                        <th className="pr-3">Version</th>
                        <td>v{image.version}</td>
                      </tr>
                      <tr>
                        <th className="pr-3">Bootable</th>
                        <td>{String(image.bootable)}</td>
                      </tr>
                      <tr>
                        <th className="pr-3">Pending</th>
                        <td>{String(image.pending)}</td>
                      </tr>
                      <tr>
                        <th className="pr-3">Hash</th>
                        <td>{hashStr}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
          <div className="mb-3">
            <button
              onClick={() => mcumgrRef.current.cmdImageState()}
              className="btn btn-info mr-2"
            >
              Refresh
            </button>
            <button
              onClick={() => mcumgrRef.current.cmdImageErase()}
              className="btn btn-warning mr-2"
            >
              Erase
            </button>
            <button
              onClick={() => {
                if (images[1] && images[1].pending === false) {
                  mcumgrRef.current.cmdImageTest(images[1].hash);
                }
              }}
              className="btn btn-primary mr-2"
              disabled={!images[1] || images[1].pending !== false}
            >
              Test
            </button>
          </div>
          <hr />
          <h3>Image Upload</h3>
          <div className="form-group my-2">
            <input type="file" onChange={onSelectFile} className="form-control" />
            <div className="my-2">{status}</div>
            <button
              onClick={handleUpload}
              className="btn btn-primary"
              disabled={!fileData || isUploading}
            >
              {isUploading ? "Uploading..." : "Upload"}
            </button>
          </div>
          <hr />
          <button
            onClick={() => mcumgrRef.current.cmdReset()}
            className="btn btn-warning"
          >
            Reset
          </button>
        </div>
      )}
      
      </div>
  );
}