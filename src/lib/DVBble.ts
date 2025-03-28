import { BleClient } from "@capacitor-community/bluetooth-le";
import { Capacitor } from "@capacitor/core";
import CBOR from "cbor";

export default class DVBDeviceBLE {
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private userRequestedDisconnect = false;

  private SERVICE_UUID = "8d53dc1d-1db7-4cd3-868b-8a527460aa84";
  private CHARACTERISTIC_UUID = "da2e7828-fbce-4e01-ae9e-261174997c48";
  private mtu = 140;
  private device: any = null;
  private service: any = null;
  private characteristic: any = null;

  private connectCallback: Function | null = null;
  private connectingCallback: Function | null = null;
  private disconnectCallback: Function | null = null;
  private messageCallback: Function | null = null;
  private imageUploadProgressCallback: Function | null = null;
  private imageUploadFinishedCallback: Function | null = null;

  private buffer = new Uint8Array();
  private logger = { info: console.log, error: console.error };
  private seq = 0;

  private uploadImage: any = null;
  private uploadOffset = 0;
  private uploadSlot = 0;
  private uploadIsInProgress = false;

  // DVB
  private serviceDVB: any = null;
  private serviceInfo: any = null;
  private listOfFiles: any = [];
  private shortname: any = null;
  private serialNumber: any = null;
  private firmwareVersion: any = null;
  private hardwareVersion: any = null;
  private duDeviceUIDVersion: any;

  // Serials
  private DEVICE_INFORMATION_SERVICE_UUID =
    "0000180a-0000-1000-8000-00805f9b34fb";
  private SERIAL_NUMBER_UUID = "dbd00001-ff30-40a5-9ceb-a17358d31999";
  private FIRMWARE_REVISION_UUID = "00002a26-0000-1000-8000-00805f9b34fb";
  private HARDWARE_REVISION_UUID = "00002a27-0000-1000-8000-00805f9b34fb";
  private DVB_SERVICE_UUID = "dbd00001-ff30-40a5-9ceb-a17358d31999";
  private LIST_FILES_UUID = "dbd00010-ff30-40a5-9ceb-a17358d31999";
  private SHORTNAME_UUID = "dbd00002-ff30-40a5-9ceb-a17358d31999";
  private WRITE_TOdevice_UUID = "dbd00011-ff30-40a5-9ceb-a17358d31999";
  private READ_FROMdevice_UUID = "dbd00012-ff30-40a5-9ceb-a17358d31999";
  private FORMAT_STORAGE_UUID = "dbd00013-ff30-40a5-9ceb-a17358d31999";
  private DU_DEVICE_UID_UUID = "dbd00003-ff30-40a5-9ceb-a17358d31999";

  private async requestBrowserDevice() {
    const params = {
      acceptAllDevices: false,
      optionalServices: [
        this.SERVICE_UUID,
        this.DVB_SERVICE_UUID,
        this.DEVICE_INFORMATION_SERVICE_UUID,
      ],
      filters: [{ namePrefix: "DVB" }],
    };
    return navigator.bluetooth.requestDevice(params);
  }

  private async requestMobileDevice() {
    const params = {
      services: [
        this.SERVICE_UUID,
        this.DVB_SERVICE_UUID,
        this.DEVICE_INFORMATION_SERVICE_UUID,
      ],
      allowDuplicates: false,
      name: "",
    };

    return new Promise((resolve, reject) => {
      BleClient.requestLEScan(params, (result) => {
        if (result.localName) {
          BleClient.stopLEScan();
          resolve({
            deviceId: result.device.deviceId,
            name: result.localName,
          });
        }
      }).catch(reject);

      setTimeout(() => {
        BleClient.stopLEScan();
        reject(new Error("Scan timeout"));
      }, 10000);
    });
  }

  public async connect() {
    if (Capacitor.isNativePlatform()) {
      try {
        this.device = await this.requestMobileDevice();
        this.logger.info(
          `Connecting to device ${this.device.name || this.device.deviceId}...`,
        );
        await BleClient.connect(this.device.deviceId);
        this.logger.info(
          `Connected to device ${this.device.name || this.device.deviceId}`,
        );

        await BleClient.startNotifications(
          this.device.deviceId,
          this.SERVICE_UUID,
          this.CHARACTERISTIC_UUID,
          (value) => {
            this.notification({ target: { value } });
          },
        );

        this.isConnected = true;
      } catch (error: any) {
        this.logger.error(`Connection error: ${error.message}`);
        this.isConnected = false;
        await this.disconnected();
        throw error;
      }
    } else {
      try {
        this.device = await this.requestBrowserDevice();
        this.device.addEventListener(
          "gattserverdisconnected",
          this.handleDisconnect.bind(this),
        );
        this.logger.info(
          `Connecting to device ${this.device.name || this.device.deviceId}...`,
        );

        const server = await this.device.gatt.connect();
        this.logger.info("Server connected.");
        this.service = await server.getPrimaryService(this.SERVICE_UUID);

        this.serviceDVB = await this.device.gatt.getPrimaryService(
          this.DVB_SERVICE_UUID,
        );
        this.serviceInfo = await this.device.gatt.getPrimaryService(
          this.DEVICE_INFORMATION_SERVICE_UUID,
        );
        this.isConnected = true;

        this.characteristic = await this.service.getCharacteristic(
          this.CHARACTERISTIC_UUID,
        );
        this.characteristic.addEventListener(
          "characteristicvaluechanged",
          this.notification.bind(this),
        );
        await this.characteristic.startNotifications();
      } catch (error: any) {
        this.logger.error(`Connection error: ${error.message}`);
        this.isConnected = false;
        await this.disconnected();
        throw error;
      }
    }

    if (this.connectingCallback) this.connectingCallback();

    this.logger.info("Service connected.");
    this.isConnected = true;

    await this.connected();

    if (this.uploadIsInProgress) {
      this.uploadNext();
    }
  }

  public getDeviceName() {
    return this.device.name;
  }

  public async setDeviceInfo() {
    if (!this.isConnected) {
      this.logger.error("Device is not connected. Cannot set device info.");
      return;
    }

    try {
      await this.setFileList();
      await this.setShortName();
      await this.setSerialNumber();
      await this.setHardwareVersion();
      await this.setFirmwareVersion();
      await this.setDUDeviceUID();
    } catch (error: any) {
      this.logger.error(`Error setting device info: ${error.message}`);
    }
  }

  private async handleDisconnect(event: any) {
    this.logger.info("Device disconnected", event);
    this.isConnected = false;
    if (!this.userRequestedDisconnect) {
      this.logger.info("Attempting to reconnect...");
      this.reconnectAttempts = 0;
      this.reconnect();
    } else {
      console.log("User requested disconnect");
      await this.disconnected();
    }
  }

  private async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(
        "Max reconnection attempts reached. Please try connecting manually.",
      );
      await this.disconnected();
      return;
    }

    this.reconnectAttempts++;
    this.logger.info(`Reconnection attempt ${this.reconnectAttempts}...`);

    try {
      await this.connect();
    } catch (error: any) {
      this.logger.error(`Reconnection error: ${error.message}`);
      setTimeout(() => this.reconnect(), 2000);
    }
  }

  public disconnect() {
    this.userRequestedDisconnect = true;
    if (Capacitor.isNativePlatform()) {
      return BleClient.disconnect(this.device.deviceId);
    } else {
      return this.device.gatt.disconnect();
    }
  }

  public onConnecting(callback: Function) {
    this.connectingCallback = callback;
    return this;
  }

  public onConnect(callback: Function) {
    this.connectCallback = callback;
    return this;
  }

  public onDisconnect(callback: Function) {
    this.disconnectCallback = callback;
    return this;
  }

  public onMessage(callback: Function) {
    this.messageCallback = callback;
    return this;
  }

  public onImageUploadProgress(callback: Function) {
    this.imageUploadProgressCallback = callback;
    return this;
  }

  public onImageUploadFinished(callback: Function) {
    this.imageUploadFinishedCallback = callback;
    return this;
  }

  private async connected() {
    this.userRequestedDisconnect = false;
    if (this.connectCallback) this.connectCallback();
  }

  private async disconnected() {
    this.logger.info("Disconnected.");
    if (this.disconnectCallback) this.disconnectCallback();
    this.device = null;
    this.service = null;
    this.serviceDVB = null;
    this.serviceInfo = null;
    this.characteristic = null;
    this.uploadIsInProgress = false;
    this.serialNumber = null;
    this.listOfFiles = [];
  }

  public getName() {
    return this.device && this.device.name;
  }

  private async sendMessage(op: number, group: number, id: number, data?: any) {
    const _flags = 0;
    let encodedData: any = [];
    if (typeof data !== "undefined") {
      encodedData = [...new Uint8Array(CBOR.encode(data))];
    }
    const length_lo = encodedData.length & 255;
    const length_hi = encodedData.length >> 8;
    const group_lo = group & 255;
    const group_hi = group >> 8;
    const message = [
      op,
      _flags,
      length_hi,
      length_lo,
      group_hi,
      group_lo,
      this.seq,
      id,
      ...encodedData,
    ];
    await this.characteristic.writeValueWithoutResponse(
      Uint8Array.from(message),
    );
    this.seq = (this.seq + 1) % 256;
  }

  private notification(event: any) {
    console.log("message received");
    const message = new Uint8Array(event.target.value.buffer);
    this.buffer = new Uint8Array([...this.buffer, ...message]);
    const messageLength = this.buffer[2] * 256 + this.buffer[3];
    if (this.buffer.length < messageLength + 8) return;
    this.processMessage(this.buffer.slice(0, messageLength + 8));
    this.buffer = this.buffer.slice(messageLength + 8);
  }

  private processMessage(message: Uint8Array<ArrayBuffer>) {
    const [op, _flags, length_hi, length_lo, group_hi, group_lo, _seq, id] =
      message;
    const data = CBOR.decode(message.slice(8).buffer);
    const length = length_hi * 256 + length_lo;
    const group = group_hi * 256 + group_lo;
    if (
      group === 1 &&
      id === 1 &&
      (data.rc === 0 || data.rc === undefined) &&
      data.off
    ) {
      this.uploadOffset = data.off;
      this.uploadNext();
      return;
    }
    if (this.messageCallback)
      this.messageCallback({ op, group, id, data, length });
  }

  public cmdReset() {
    return this.sendMessage(2, 0, 5);
  }

  public smpEcho(message: any) {
    return this.sendMessage(2, 0, 0, { d: message });
  }

  public cmdImageState() {
    return this.sendMessage(0, 1, 0);
  }

  public cmdImageErase() {
    return this.sendMessage(2, 1, 5, {});
  }

  public cmdImageTest(hash: any) {
    return this.sendMessage(2, 1, 0, {
      hash,
      confirm: false,
    });
  }

  public cmdImageConfirm(hash: any) {
    return this.sendMessage(2, 1, 0, {
      hash,
      confirm: true,
    });
  }

  private hash(image: BufferSource) {
    return crypto.subtle.digest("SHA-256", image);
  }

  private async uploadNext() {
    if (this.uploadOffset >= this.uploadImage.byteLength) {
      this.uploadIsInProgress = false;
      this.imageUploadFinishedCallback?.();
      return;
    }

    const nmpOverhead = 8;
    const message: any = { data: new Uint8Array(), off: this.uploadOffset };
    if (this.uploadOffset === 0) {
      message.len = this.uploadImage.byteLength;
      message.sha = new Uint8Array(await this.hash(this.uploadImage));
    }
    this.imageUploadProgressCallback?.({
      percentage: Math.floor(
        (this.uploadOffset / this.uploadImage.byteLength) * 100,
      ),
    });

    const length = this.mtu - CBOR.encode(message).byteLength - nmpOverhead;

    message.data = new Uint8Array(
      this.uploadImage.slice(this.uploadOffset, this.uploadOffset + length),
    );

    this.uploadOffset += length;

    this.sendMessage(2, 1, 1, message);
  }

  public async cmdUpload(image: any, slot = 0) {
    if (this.uploadIsInProgress) {
      this.logger.error("Upload is already in progress.");
      return;
    }
    this.uploadIsInProgress = true;

    this.uploadOffset = 0;
    this.uploadImage = image;
    this.uploadSlot = slot;

    this.uploadNext();
  }

  public async imageInfo(image: any) {
    const info: any = {};
    const view = new Uint8Array(image);

    if (view.length < 4096) {
      throw new Error("Image header is too short");
    }

    const version = [view[12], view[13], view[14], view[15]].join(".");
    info.version = version;

    const hashStart = 20;
    const hashEnd = hashStart + 32;
    const hash = view.slice(hashStart, hashEnd);
    info.hash = hash;

    return info;
  }

  public getShortName() {
    return this.shortname;
  }

  public async setShortName(shortname?: string) {
    try {
      if (Capacitor.isNativePlatform()) {
        if (!shortname) {
          const result = await BleClient.read(
            this.device.deviceId,
            this.DVB_SERVICE_UUID,
            this.SHORTNAME_UUID,
          );
          this.shortname = new TextDecoder().decode(result);
        } else {
          const uf8encode = new TextEncoder();
          const newShortName: any = uf8encode.encode(shortname);
          await BleClient.write(
            this.device.deviceId,
            this.DVB_SERVICE_UUID,
            this.SHORTNAME_UUID,
            newShortName,
          );
          this.shortname = shortname;
        }
      } else {
        if (!shortname) {
          const characteristic = await this.serviceDVB.getCharacteristic(
            this.SHORTNAME_UUID,
          );
          const value = await characteristic.readValue();
          this.shortname = new TextDecoder().decode(value);
        } else {
          const characteristic = await this.serviceDVB.getCharacteristic(
            this.SHORTNAME_UUID,
          );
          const uf8encode = new TextEncoder();
          const newShortName = uf8encode.encode(shortname);
          await characteristic.writeValue(newShortName);
          this.shortname = newShortName;
        }
      }
    } catch (error) {
      this.logger.error(error);
    }
  }

  public getFileList() {
    return this.listOfFiles;
  }

  public async setFileList() {
    if (!this.isConnected) {
      this.logger.error("Device is not connected. Cannot set file list.");
      return;
    }
    try {
      if (Capacitor.isNativePlatform()) {
        while (true) {
          const value: any = await BleClient.read(
            this.device.deviceId,
            this.DVB_SERVICE_UUID,
            this.LIST_FILES_UUID,
          );
          const message: any = new Uint8Array(value);
          if (message.byteLength === 0) return;
          const byteString = String.fromCharCode(...message);
          const split_string = byteString.split(";");
          const name = split_string[0];
          const length = split_string[1];
          this.listOfFiles.push({ name, length });
        }
      } else {
        while (true) {
          const characteristic = await this.serviceDVB.getCharacteristic(
            this.LIST_FILES_UUID,
          );
          const value = await characteristic.readValue();
          const message = new Uint8Array(value.buffer);
          if (message.byteLength === 0) return;
          const byteString = String.fromCharCode(...message);
          const split_string = byteString.split(";");
          const name = split_string[0];
          const length = split_string[1];
          this.listOfFiles.push({ name, length });
        }
      }
    } catch (error: any) {
      this.logger.error(`Error setting file list: ${error.message}`);
    }
  }

  public async getFileContent(name: string, progressCallback: Function) {
    try {
      const arrayBuffers: any = [];
      let offset = 0;
      let totalSize = 0;
      const CHUNK_SIZE = 65536;

      const fileInfo = this.listOfFiles.find((file: any) => file.name === name);
      if (fileInfo) {
        totalSize = parseInt(fileInfo.length);
      }

      const utf8encoder = new TextEncoder();

      if (Capacitor.isNativePlatform()) {
        while (true) {
          try {
            const name_bytes: any = utf8encoder.encode(`${name};${offset};`);
            await BleClient.write(
              this.device.deviceId,
              this.DVB_SERVICE_UUID,
              this.WRITE_TOdevice_UUID,
              name_bytes,
            );

            const display_info: any = await BleClient.read(
              this.device.deviceId,
              this.DVB_SERVICE_UUID,
              this.READ_FROMdevice_UUID,
            );

            if (display_info.byteLength !== 0) {
              const array: any = new Uint8Array(display_info);
              array.map((x: any) => arrayBuffers.push(x));

              if (arrayBuffers.length % CHUNK_SIZE === 0) {
                offset += CHUNK_SIZE;
                this.logger.info(`Reached 64 KB, updating offset: ${offset}`);
              }

              if (totalSize > 0 && progressCallback) {
                const progress = Math.min(
                  100,
                  Math.round((arrayBuffers.length / totalSize) * 100),
                );
                progressCallback(progress);
              }
            } else {
              break;
            }
          } catch (error) {
            this.logger.error(
              `Error reading data, retrying at offset ${offset}`,
              error,
            );
            await new Promise((resolve) => setTimeout(resolve, 500)); // Small delay before retrying
          }
        }
      } else {
        const write_characteristic = await this.serviceDVB.getCharacteristic(
          this.WRITE_TOdevice_UUID,
        );
        const read_characteristic = await this.serviceDVB.getCharacteristic(
          this.READ_FROMdevice_UUID,
        );

        while (true) {
          try {
            if (arrayBuffers.length % CHUNK_SIZE === 0) {
              const name_bytes: any = utf8encoder.encode(`${name};${offset};`);
              await write_characteristic.writeValue(name_bytes);
            }

            const display_info = await read_characteristic.readValue();

            if (display_info.byteLength !== 0) {
              const array = new Uint8Array(display_info.buffer);
              arrayBuffers.push(...array);

              if (arrayBuffers.length >= offset + CHUNK_SIZE) {
                offset += CHUNK_SIZE;
                this.logger.info(`Reached 64 KB, updating offset: ${offset}`);
              }

              if (totalSize > 0 && progressCallback) {
                const progress = Math.min(
                  100,
                  Math.round((arrayBuffers.length / totalSize) * 100),
                );
                progressCallback(progress);
              }
            } else {
              break;
            }
          } catch (error) {
            this.logger.error(
              `Error reading data, retrying at offset ${offset}`,
              error,
            );
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      }

      return new Uint8Array(arrayBuffers);
    } catch (error) {
      this.logger.error(error);
    }
  }

  public async formatStorage() {
    try {
      if (Capacitor.isNativePlatform()) {
        await BleClient.read(
          this.device.deviceId,
          this.DVB_SERVICE_UUID,
          this.FORMAT_STORAGE_UUID,
        );
      } else {
        const characteristic = await this.serviceDVB.getCharacteristic(
          this.FORMAT_STORAGE_UUID,
        );
        await characteristic.readValue();
      }
      this.logger.info("Files erased");
    } catch (error) {
      this.logger.error(error);
    }
  }

  public getSerialNumber() {
    return this.serialNumber;
  }

  public async setSerialNumber() {
    try {
      if (Capacitor.isNativePlatform()) {
        const serial = await BleClient.read(
          this.device.deviceId,
          this.DEVICE_INFORMATION_SERVICE_UUID,
          this.SERIAL_NUMBER_UUID,
        );
        const serialNumber = new TextDecoder().decode(serial);
        this.serialNumber = serialNumber;
      } else {
        const characteristic = await this.serviceDVB.getCharacteristic(
          this.SERIAL_NUMBER_UUID,
        );
        const serial = await characteristic.readValue();
        const serialNumber = new TextDecoder().decode(serial);
        this.serialNumber = serialNumber;
        this.logger.info(`Serial Number: ${this.serialNumber}`);
      }
    } catch (error) {
      this.logger.error(error);
    }
  }

  public getFirmwareVersion() {
    return this.firmwareVersion;
  }

  public async setFirmwareVersion() {
    try {
      if (Capacitor.isNativePlatform()) {
        const firmware = await BleClient.read(
          this.device.deviceId,
          this.DEVICE_INFORMATION_SERVICE_UUID,
          this.FIRMWARE_REVISION_UUID,
        );
        const firmwareVersion = new TextDecoder().decode(firmware);
        this.logger.info("Firmware Version:", firmwareVersion);
        this.firmwareVersion = firmwareVersion;
      } else {
        const characteristic = await this.serviceInfo.getCharacteristic(
          this.FIRMWARE_REVISION_UUID,
        );
        const firmware = await characteristic.readValue();
        const firmwareVersion = new TextDecoder().decode(firmware);
        this.logger.info("Firmware Version:", firmwareVersion);
        this.firmwareVersion = firmwareVersion;
      }
    } catch (error) {
      this.logger.error("Error getting firmware version:", error);
      throw error;
    }
  }

  public getHardwareVersion() {
    return this.hardwareVersion;
  }

  public async setHardwareVersion() {
    try {
      if (Capacitor.isNativePlatform()) {
        const hardware = await BleClient.read(
          this.device.deviceId,
          this.DEVICE_INFORMATION_SERVICE_UUID,
          this.HARDWARE_REVISION_UUID,
        );
        const hardwareVersion = new TextDecoder().decode(hardware);
        this.logger.info("Hardware Version:", hardwareVersion);
        this.hardwareVersion = hardwareVersion;
      } else {
        const characteristic = await this.serviceInfo.getCharacteristic(
          this.HARDWARE_REVISION_UUID,
        );
        const hardware = await characteristic.readValue();
        const hardwareVersion = new TextDecoder().decode(hardware);
        this.logger.info("Hardware Version:", hardwareVersion);
        this.hardwareVersion = hardwareVersion;
      }
    } catch (error) {
      this.logger.error("Error getting firmware version:", error);
      throw error;
    }
  }

  public getDUDeviceUID() {
    return this.duDeviceUIDVersion;
  }

  public async setDUDeviceUID() {
    try {
      if (Capacitor.isNativePlatform()) {
        const duDeviceUID = await BleClient.read(
          this.device.deviceId,
          this.DVB_SERVICE_UUID,
          this.DU_DEVICE_UID_UUID,
        );
        const duDeviceUIDString = new TextDecoder().decode(duDeviceUID);
        this.logger.info("DUDeviceUID:", duDeviceUIDString);
        this.duDeviceUIDVersion = duDeviceUIDString;
      } else {
        const characteristic = await this.serviceDVB.getCharacteristic(
          this.DU_DEVICE_UID_UUID,
        );
        const duDeviceUID = await characteristic.readValue();
        const duDeviceUIDVersion = new TextDecoder().decode(duDeviceUID);
        this.logger.info("DU Device UID Version:", duDeviceUIDVersion);
        this.duDeviceUIDVersion = duDeviceUIDVersion;
      }
    } catch (error) {
      this.logger.error("Error getting DUDeviceUID", error);
      throw error;
    }
  }
}
