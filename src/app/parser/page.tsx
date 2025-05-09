"use client"

import React, { useState } from "react";

// Helper: decode payload by type
function decodeContent(type: number, payload: Uint8Array): string {
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  function f32(i: number) { return dv.getFloat32(i, true); }
  function u16(i: number) { return dv.getUint16(i, true); }
  function u8(i: number) { return dv.getUint8(i); }
  function i32(i: number) { return dv.getInt32(i, true); }
  function u32(i: number) { return dv.getUint32(i, true); }
  function hex(bytes: Uint8Array) { return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '); }
  try {
    switch (type) {
      case 0x20: // Accel
        if (payload.length >= 14) {
          const count = u16(0);
          const x = f32(2), y = f32(6), z = f32(10);
          const sampleText = count > 1 ? "samples" : "sample";
          return `Accel: ${x.toFixed(6)}; ${y.toFixed(6)}; ${z.toFixed(6)}; m/s/s; ${count} ${sampleText}`;
        }
        break;
      case 0x30: // Gyro
        if (payload.length >= 14) {
          const count = u16(0);
          const x = f32(2), y = f32(6), z = f32(10);
          const sampleText = count > 1 ? "samples" : "sample";
          return `Gyro: ${x.toFixed(6)}; ${y.toFixed(6)}; ${z.toFixed(6)}; Rad/s; ${count} ${sampleText}`;
        }
        break;
      case 0x60: // Compass
        if (payload.length >= 14) {
          const count = u16(0);
          const x = f32(2), y = f32(6), z = f32(10);
          const sampleText = count > 1 ? "samples" : "sample";
          return `Compass: ${x.toFixed(6)}; ${y.toFixed(6)}; ${z.toFixed(6)}; Gauss; ${count} ${sampleText}`;
        }
        break;
      case 0x40: // Pressure
        if (payload.length >= 6) {
          const count = u16(0);
          const value = f32(2);
          const sampleText = count > 1 ? "samples" : "sample";
          return `Pressure: ${value.toFixed(1)} mbar; ${count} ${sampleText}`;
        }
        break;
      case 0x50: // Temperature
        if (payload.length >= 6) {
          const count = u16(0);
          const value = f32(2);
          const sampleText = count > 1 ? "samples" : "sample";
          return `Temperature: ${value.toFixed(2)} °C; ${count} ${sampleText}`;
        }
        break;
      case 0x51: // Internal Temperature
        if (payload.length >= 6) {
          const count = u16(0);
          const value = f32(2);
          const sampleText = count > 1 ? "samples" : "sample";
          return `Internal Temperature: ${value.toFixed(2)} °C; ${count} ${sampleText}`;
        }
        break;
      case 0x70: // Accumulator
        if (payload.length >= 8) {
          const count = u16(0);
          const value = f32(2);
          const chargingState = u8(6) === 0x00 ? "Discharging" : "Charging";
          const chargeState = u8(7);
          const sampleText = count > 1 ? "samples" : "sample";
          return `Accumulator: ${value.toFixed(3)} V; ${count} ${sampleText}, ${chargingState} ,${chargeState} %; ${count} ${sampleText}`;
        }
        break;
      case 0x80: // Switch
        if (payload.length >= 2) {
          return `Switch ${u8(1)} -> ${u8(0)}`;
        }
        break;
      case 0x10: // GPS
        if (payload.length >= 20) {
          const lon = i32(0) / 1e7;
          const lat = i32(4) / 1e7;
          const height = i32(8) / 1e3;
          const utc = u32(12);
          const flags = u8(16);
          const fix = u8(17);
          const utcValid = u8(18);
          const sat = u8(19);
          const dt = new Date(utc * 1000);
          const dateStr = `${dt.getDate()}. ${dt.getMonth()+1}. ${dt.getFullYear()} ${dt.getHours()}:${dt.getMinutes().toString().padStart(2,'0')}:${dt.getSeconds().toString().padStart(2,'0')}`;
          return `${dateStr}, LA:${lat.toFixed(7)}°, LO:${lon.toFixed(7)}°, H:${height.toFixed(3)},Flags:${flags}, Fix:${fix}, UtcValid: ${utcValid}, Sat: ${sat}`;
        }
        break;
      case 0x04: // Start
        return `START ${String.fromCharCode(...payload).replace(/[^\x20-\x7E]+/g, ' ')}`;
      case 0xA0: // Lora Tx
        return `Lora Tx: ${payload.length} bytes`;
      case 0xA1: // Lora Rx
        return `Lora Rx: ${payload.length} bytes`;
      default:
        return "";
    }
  } catch (e) {
    return `Parse error: ${hex(payload)}`;
  }
}

// Helper: convert timestamp in ms to hh:mm:ss.mmm format
function msToTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const msRemainder = ms % 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return (
    hours.toString().padStart(2, '0') + ':' +
    minutes.toString().padStart(2, '0') + ':' +
    seconds.toString().padStart(2, '0') + '.' +
    msRemainder.toString().padStart(3, '0')
  );
}

// Helper: parse .dvb binary file
function parseDVB(buffer: ArrayBuffer) {
  const records = [];
  const view = new DataView(buffer);
  const u8 = new Uint8Array(buffer);
  let offset = 0;
  while (offset + 8 <= buffer.byteLength) {
    if (u8[offset] !== 0x02) { // Start byte
      offset++;
      continue;
    }
    const type = u8[offset + 1];
    const timestamp = view.getUint32(offset + 2, true); // little-endian
    const length = u8[offset + 6];
    if (offset + 7 + length >= buffer.byteLength) break;
    const payload = u8.slice(offset + 7, offset + 7 + length);
    const endByte = u8[offset + 7 + length];
    if (endByte !== 0x03) {
      offset++;
      continue;
    }
    records.push({
      type: '0x' + type.toString(16),
      timestamp: msToTime(timestamp),
      content: decodeContent(type, payload),
      length,
      payload: Array.from(payload).map(b => b.toString(16).padStart(2, '0')).join(' ')
    });
    offset += 8 + length - 1;
    offset++;
  }
  return records;
}

export default function Parser() {
  const [parsed, setParsed] = useState<any>(null);
  const [error, setError] = useState<string>("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    setParsed(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Try DVB parse
      let data;
      try {
        data = parseDVB(arrayBuffer);
      } catch (err) {
        setError("Failed to parse file as DVB");
        return;
      }
      setParsed(data);
    } catch (err) {
      setError("Failed to read file");
    }
  };

  // Helper to render object/array as table
  function renderTable(data: any) {
    if (Array.isArray(data)) {
      if (data.length === 0) return <div>No data</div>;
      const keys = ['type', 'timestamp', 'content', 'length', 'payload'];
      return (
        <table className="table-auto border-collapse border w-full mt-4">
          <thead>
            <tr>
              {keys.map((k) => (
                <th key={k} className="border px-2 py-1">{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>
                {keys.map((k) => (
                  <td key={k} className="border px-2 py-1">{String(row[k] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    } else if (typeof data === "object" && data !== null) {
      const keys = Object.keys(data);
      return (
        <table className="table-auto border-collapse border w-full mt-4">
          <thead>
            <tr>
              <th className="border px-2 py-1">Key</th>
              <th className="border px-2 py-1">Value</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k}>
                <td className="border px-2 py-1">{k}</td>
                <td className="border px-2 py-1">{JSON.stringify(data[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    } else {
      return <pre className="mt-4">{String(data)}</pre>;
    }
  }

  return (
    <section className=" mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Device File Parser</h1>
      <input
        type="file"
        accept=".dvb"
        onChange={handleFile}
        className="mb-4"
      />
      {error && <div className="text-red-600 mb-2">{error}</div>}
      {parsed && (
        <div>
          <h2 className="text-xl font-semibold mt-4 mb-2">Parsed Data</h2>
          {renderTable(parsed)}
        </div>
      )}
    </section>
  );
}
