import { BleClient, BleDevice } from "@capacitor-community/bluetooth-le";
import { Capacitor } from "@capacitor/core";
import CBOR from "./cbor";

type DeviceType = BluetoothDevice | BleDevice;
export default class DVBDeviceBLE {
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private userRequestedDisconnect = false;

  private SERVICE_UUID = "8d53dc1d-1db7-4cd3-868b-8a527460aa84";
  private CHARACTERISTIC_UUID = "da2e7828-fbce-4e01-ae9e-261174997c48";
  private mtu = 140;
  private device: DeviceType | null = null;
  private service: BluetoothRemoteGATTService | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private connectCallback: (() => void) | null = null;
  private connectingCallback: (() => void) | null = null;
  private disconnectCallback: (() => void) | null = null;
  private messageCallback:
    | ((message: {
        op: number;
        group: number;
        id: number;
        data: unknown;
        length: number;
      }) => void)
    | null = null;
  private imageUploadProgressCallback = null;
  private imageUploadFinishedCallback: (() => void) | null = null;

  private buffer = new Uint8Array();
  private logger = { info: console.log, error: console.error };
  private seq = 0;

  private uploadImage: Uint8Array | null = null;
  private uploadOffset = 0;
  private uploadIsInProgress = false;
  private uploadSlot = 0;
  private duSerialNumber: string | null = null;

  // DVB
  private serviceDVB: BluetoothRemoteGATTService | null = null;
  private serviceInfo: BluetoothRemoteGATTService | null = null;
  private listOfFiles: { name: string; length: string }[] = [];
  private shortname: string | null = null;
  private serialNumber: string | null = null;
  private firmwareVersion: string | null = null;
  private hardwareVersion: string | null = null;
  private duDeviceUIDVersion: string | null = null;

  // Serials
  private DEVICE_INFORMATION_SERVICE_UUID =
    "0000180a-0000-1000-8000-00805f9b34fb";
  private SERIAL_NUMBER_UUID = "dbd00001-ff30-40a5-9ceb-a17358d31999";
  private FIRMWARE_REVISION_UUID = "00002a26-0000-1000-8000-00805f9b34fb";
  private HARDWARE_REVISION_UUID = "00002a27-0000-1000-8000-00805f9b34fb";
  private DVB_SERVICE_UUID = "dbd00001-ff30-40a5-9ceb-a17358d31999";
  private LIST_FILES_UUID = "dbd00010-ff30-40a5-9ceb-a17358d31999";
  private WRITE_TO_DEVICE_UUID = "dbd00011-ff30-40a5-9ceb-a17358d31999";
  private READ_FROM_DEVICE_UUID = "dbd00012-ff30-40a5-9ceb-a17358d31999";
  private FORMAT_STORAGE_UUID = "dbd00013-ff30-40a5-9ceb-a17358d31999";
  private SHORTNAME_UUID = "dbd00002-ff30-40a5-9ceb-a17358d31999";
  private DU_SHORTNAME_UUID = "dbd00002-ff30-40a5-9ceb-a17358d31999";
  private DU_DEVICE_UID_UUID = "dbd00003-ff30-40a5-9ceb-a17358d31999";
  private DU_SERIAL_NUMBER_UUID = "dbd00001-ff30-40a5-9ceb-a17358d31999";
  private DU_SERVER_REGISTRATION_UUID = "dbd00006-ff30-40a5-9ceb-a17358d31999";
  private DU_MANUFACTURER_SERIAL_UUID = "dbd00008-ff30-40a5-9ceb-a17358d31999";
  private DU_SENSOR_SETTING_UUID = "dbd00007-ff30-40a5-9ceb-a17358d31999";

  private manufacturerSerialNumber: string | null = null;

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

  private async requestMobileDevice(): Promise<BleDevice> {
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
          } as BleDevice);
        }
      }).catch(reject);

      setTimeout(() => {
        BleClient.stopLEScan();
        reject(new Error("Scan timeout"));
      }, 10000);
    });
  }

  private isBleDevice(device: DeviceType): device is BleDevice {
    return "deviceId" in device;
  }

  private isBluetoothDevice(device: DeviceType): device is BluetoothDevice {
    return "gatt" in device;
  }

  private getDeviceDisplayName(device: DeviceType | null): string {
    if (!device) return "Unknown Device";
    return this.isBleDevice(device)
      ? device.name || device.deviceId
      : device.name || "Unknown Device";
  }

  public async connect() {
    if (Capacitor.isNativePlatform()) {
      try {
        this.device = await this.requestMobileDevice();
        this.logger.info(
          `Connecting to device ${this.getDeviceDisplayName(this.device)}...`
        );
        await BleClient.connect(this.device.deviceId);
        this.logger.info(
          `Connected to device ${this.getDeviceDisplayName(this.device)}`
        );

        await BleClient.startNotifications(
          this.device.deviceId,
          this.SERVICE_UUID,
          this.CHARACTERISTIC_UUID,
          (value) => {
            this.notification({ target: { value } });
          }
        );

        this.isConnected = true;
      } catch (error: unknown) {
        this.logger.error(
          `Connection error: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        this.isConnected = false;
        await this.disconnected();
        throw error;
      }
    } else {
      try {
        this.device = (await this.requestBrowserDevice()) as BluetoothDevice;
        if (!this.device) {
          throw new Error("Failed to get device");
        }
        this.device.addEventListener(
          "gattserverdisconnected",
          this.handleDisconnect.bind(this)
        );
        this.logger.info(
          `Connecting to device ${this.getDeviceDisplayName(this.device)}...`
        );

        const server = await this.device.gatt?.connect();
        if (!server) {
          throw new Error("Failed to connect to GATT server");
        }
        this.logger.info("Server connected.");

        // Get all required services with retries
        const getServiceWithRetry = async (
          uuid: string,
          retries = 3
        ): Promise<BluetoothRemoteGATTService> => {
          for (let i = 0; i < retries; i++) {
            try {
              const service = await server.getPrimaryService(uuid);
              if (service) return service;
              //eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (error) {
              this.logger.info(`Retry ${i + 1} getting service ${uuid}`);
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
          throw new Error(
            `Failed to get service ${uuid} after ${retries} retries`
          );
        };

        // Get all services in parallel
        const [serviceResult, serviceDVBResult, serviceInfoResult] =
          await Promise.all([
            getServiceWithRetry(this.SERVICE_UUID),
            getServiceWithRetry(this.DVB_SERVICE_UUID),
            getServiceWithRetry(this.DEVICE_INFORMATION_SERVICE_UUID),
          ]);

        this.service = serviceResult;
        this.serviceDVB = serviceDVBResult;
        this.serviceInfo = serviceInfoResult;

        if (!this.serviceDVB) {
          throw new Error("DVB service not found");
        }

        // Get characteristic with retries
        const getCharacteristicWithRetry = async (
          service: BluetoothRemoteGATTService,
          uuid: string,
          retries = 3
        ): Promise<BluetoothRemoteGATTCharacteristic> => {
          for (let i = 0; i < retries; i++) {
            try {
              const characteristic = await service.getCharacteristic(uuid);
              if (characteristic) return characteristic;
              //eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (error) {
              this.logger.info(`Retry ${i + 1} getting characteristic ${uuid}`);
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
          throw new Error(
            `Failed to get characteristic ${uuid} after ${retries} retries`
          );
        };

        // Get main characteristic
        const characteristicResult = await getCharacteristicWithRetry(
          this.service,
          this.CHARACTERISTIC_UUID
        );
        this.characteristic = characteristicResult;

        if (this.characteristic) {
          this.characteristic.addEventListener(
            "characteristicvaluechanged",
            this.notification.bind(this)
          );
          await this.characteristic.startNotifications();
        }

        // Wait a bit to ensure everything is ready
        await new Promise((resolve) => setTimeout(resolve, 1000));

        this.isConnected = true;
      } catch (error: unknown) {
        this.logger.error(
          `Connection error: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
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
    return this.device?.name;
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
    } catch (error: unknown) {
      this.logger.error(
        `Error setting device info: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        "Max reconnection attempts reached. Please try connecting manually."
      );
      await this.disconnected();
      return;
    }

    this.reconnectAttempts++;
    this.logger.info(`Reconnection attempt ${this.reconnectAttempts}...`);

    try {
      await this.connect();
    } catch (error: unknown) {
      this.logger.error(
        `Reconnection error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      setTimeout(() => this.reconnect(), 2000);
    }
  }

  public disconnect() {
    this.userRequestedDisconnect = true;
    if (Capacitor.isNativePlatform()) {
      if (!this.device || !this.isBleDevice(this.device)) {
        return Promise.resolve();
      }
      return BleClient.disconnect(this.device.deviceId);
    } else {
      if (!this.device || !this.isBluetoothDevice(this.device)) {
        return Promise.resolve();
      }
      return this.device.gatt?.disconnect();
    }
  }

  public onConnecting(callback: () => void) {
    this.connectingCallback = callback;
    return this;
  }

  public onConnect(callback: () => void) {
    this.connectCallback = callback;
    return this;
  }

  public onDisconnect(callback: () => void) {
    this.disconnectCallback = callback;
    return this;
  }

  public onMessage(
    callback: (message: {
      op: number;
      group: number;
      id: number;
      data: unknown;
      length: number;
    }) => void
  ) {
    this.messageCallback = callback;
    return this;
  }

  public onImageUploadProgress(callback: () => void) {
    this.imageUploadProgressCallback = callback;
    return this;
  }

  public onImageUploadFinished(callback: () => void) {
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

  private async sendMessage(op, group, id, data?) {
    const _flags = 0;
    let encodedData = [];
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
    // console.log('>'  + message.map(x => x.toString(16).padStart(2, '0')).join(' '));
    await this.characteristic.writeValueWithoutResponse(
      Uint8Array.from(message)
    );
    this.seq = (this.seq + 1) % 256;
  }

  private notification(event) {
    // console.log('message received');
    const message = new Uint8Array(event.target.value.buffer);
    // console.log(message);
    // console.log('<'  + [...message].map(x => x.toString(16).padStart(2, '0')).join(' '));
    this.buffer = new Uint8Array([...this.buffer, ...message]);
    const messageLength = this.buffer[2] * 256 + this.buffer[3];
    if (this.buffer.length < messageLength + 8) return;
    this.processMessage(this.buffer.slice(0, messageLength + 8));
    this.buffer = this.buffer.slice(messageLength + 8);
  }

  private processMessage(message: Uint8Array) {
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

  public smpEcho(message: string | number | object) {
    return this.sendMessage(2, 0, 0, { d: message });
  }

  public cmdImageState() {
    return this.sendMessage(0, 1, 0);
  }

  public cmdImageErase() {
    return this.sendMessage(2, 1, 5, {});
  }

  public cmdImageTest(hash: Uint8Array) {
    return this.sendMessage(2, 1, 0, {
      hash,
      confirm: false,
    });
  }

  public cmdImageConfirm(hash: Uint8Array) {
    return this.sendMessage(2, 1, 0, {
      hash,
      confirm: true,
    });
  }

  private hash(image: BufferSource) {
    return crypto.subtle.digest("SHA-256", image);
  }

  public async cmdUpload(image, slot = 0) {
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

  private async uploadNext() {
    if (this.uploadOffset >= this.uploadImage.byteLength) {
      this.uploadIsInProgress = false;
      this.imageUploadFinishedCallback();
      return;
    }

    const nmpOverhead = 8;
    const message= { data: new Uint8Array(), off: this.uploadOffset };
    if (this.uploadOffset === 0) {
      //@ts-ignore
      message.len = this.uploadImage.byteLength;
      //@ts-ignore
      message.sha = new Uint8Array(await this.hash(this.uploadImage));
    }
    this.imageUploadProgressCallback({
      percentage: Math.floor(
        (this.uploadOffset / this.uploadImage.byteLength) * 100
      ),
    });

    const length = this.mtu - CBOR.encode(message).byteLength - nmpOverhead;

    message.data = new Uint8Array(
      this.uploadImage.slice(this.uploadOffset, this.uploadOffset + length)
    );

    this.uploadOffset += length;

    this.sendMessage(2, 1, 1, message);
  }

  public async imageInfo(image: ArrayBuffer) {
    // https://interrupt.memfault.com/blog/mcuboot-overview#mcuboot-image-binaries

    const view = new Uint8Array(image);

    // check header length
    if (view.length < 4096) {
      throw new Error("Image header is too short");
    }

    // parse image version
    const version = [view[12], view[13], view[14], view[15]].join(".");

    // parse image hash
    const hashStart = 20;
    const hashEnd = hashStart + 32;
    const hash = view.slice(hashStart, hashEnd);

    return { version, hash };
  }

  public getShortName() {
    return this.shortname;
  }

  public async setShortName(shortname?: string) {
    try {
      if (Capacitor.isNativePlatform()) {
        if (!this.device || !this.isBleDevice(this.device)) {
          throw new Error("Device not connected or not a BLE device");
        }
        if (!this.serviceDVB) {
          throw new Error("DVB service not available");
        }

        if (!shortname) {
          const result = await BleClient.read(
            this.device.deviceId,
            this.DVB_SERVICE_UUID,
            this.SHORTNAME_UUID
          );
          this.shortname = new TextDecoder().decode(result);
        } else {
          const uf8encode = new TextEncoder();
          const newShortName = uf8encode.encode(shortname);
          await BleClient.write(
            this.device.deviceId,
            this.DVB_SERVICE_UUID,
            this.SHORTNAME_UUID,
            new DataView(newShortName.buffer)
          );
          this.shortname = shortname;
        }
      } else {
        if (!this.serviceDVB) {
          throw new Error("DVB service not available");
        }

        if (!shortname) {
          const characteristic = await this.serviceDVB.getCharacteristic(
            this.SHORTNAME_UUID
          );
          const value = await characteristic.readValue();
          this.shortname = new TextDecoder().decode(value);
        } else {
          const characteristic = await this.serviceDVB.getCharacteristic(
            this.SHORTNAME_UUID
          );
          const uf8encode = new TextEncoder();
          const newShortName = uf8encode.encode(shortname);
          await characteristic.writeValue(newShortName);
          this.shortname = shortname;
        }
      }
    } catch (error) {
      this.logger.error(error);
    }
  }

  public getFileList() {
    return this.listOfFiles;
  }

  private async setFileList() {
    if (!this.isConnected) {
      this.logger.error("Device is not connected. Cannot set file list.");
      return;
    }
    try {
      if (Capacitor.isNativePlatform()) {
        if (!this.device || !this.isBleDevice(this.device)) {
          throw new Error("Device not connected or not a BLE device");
        }
        while (true) {
          const value = await BleClient.read(
            this.device.deviceId,
            this.DVB_SERVICE_UUID,
            this.LIST_FILES_UUID
          );
          const message = new Uint8Array(value.buffer);
          if (message.byteLength === 0) return;
          const byteString = String.fromCharCode(...message);
          const split_string = byteString.split(";");
          const name = split_string[0];
          const length = split_string[1];
          this.listOfFiles.push({ name, length });
        }
      } else {
        if (!this.serviceDVB) {
          throw new Error("DVB service not available");
        }

        while (true) {
          const characteristic = await this.serviceDVB.getCharacteristic(
            this.LIST_FILES_UUID
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
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Error setting file list: ${error.message}`);
      } else {
        this.logger.error(`Error setting file list: ${error}`);
      }
    }
  }

  public async getFileContent(
    name: string,
    progressCallback: (progress: number) => void
  ) {
    try {
      const arrayBuffers = [];
      let offset = 0;
      let totalSize = 0;
      const CHUNK_SIZE = 65536;

      const fileInfo = this.listOfFiles.find(
        (file: { name: string; length: string }) => file.name === name
      );
      if (fileInfo) {
        totalSize = parseInt(fileInfo.length);
      }

      const utf8encoder = new TextEncoder();

      if (Capacitor.isNativePlatform()) {
        if (!this.device || !this.isBleDevice(this.device)) {
          throw new Error("Device not connected or not a BLE device");
        }
        while (true) {
          try {
            const name_bytes: Uint8Array = utf8encoder.encode(
              `${name};${offset};`
            );
            await BleClient.write(
              this.device.deviceId,
              this.DVB_SERVICE_UUID,
              this.WRITE_TO_DEVICE_UUID,
              new DataView(name_bytes.buffer)
            );

            const display_info = await BleClient.read(
              this.device.deviceId,
              this.DVB_SERVICE_UUID,
              this.READ_FROM_DEVICE_UUID
            );

            if (display_info.byteLength !== 0) {
              const array = new Uint8Array(display_info.buffer);
              array.map((x: number) => arrayBuffers.push(x));

              if (arrayBuffers.length % CHUNK_SIZE === 0) {
                offset += CHUNK_SIZE;
                this.logger.info(`Reached 64 KB, updating offset: ${offset}`);
              }

              if (totalSize > 0 && progressCallback) {
                const progress = Math.min(
                  100,
                  Math.round((arrayBuffers.length / totalSize) * 100)
                );
                progressCallback(progress);
              }
            } else {
              break;
            }
          } catch (error) {
            this.logger.error(
              `Error reading data, retrying at offset ${offset}`,
              error
            );
            await new Promise((resolve) => setTimeout(resolve, 500)); // Small delay before retrying
          }
        }
      } else {
        if (!this.serviceDVB) {
          throw new Error("DVB service not available");
        }

        const write_characteristic = await this.serviceDVB.getCharacteristic(
          this.WRITE_TO_DEVICE_UUID
        );
        const read_characteristic = await this.serviceDVB.getCharacteristic(
          this.READ_FROM_DEVICE_UUID
        );

        while (true) {
          try {
            if (arrayBuffers.length % CHUNK_SIZE === 0) {
              const name_bytes: Uint8Array = utf8encoder.encode(
                `${name};${offset};`
              );
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
                  Math.round((arrayBuffers.length / totalSize) * 100)
                );
                progressCallback(progress);
              }
            } else {
              break;
            }
          } catch (error) {
            this.logger.error(
              `Error reading data, retrying at offset ${offset}`,
              error
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
        if (!this.device || !this.isBleDevice(this.device)) {
          throw new Error("Device not connected or not a BLE device");
        }
        await BleClient.read(
          this.device.deviceId,
          this.DVB_SERVICE_UUID,
          this.FORMAT_STORAGE_UUID
        );
      } else {
        if (!this.serviceDVB) {
          throw new Error("DVB service not available");
        }

        const characteristic = await this.serviceDVB.getCharacteristic(
          this.FORMAT_STORAGE_UUID
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
        if (!this.device || !this.isBleDevice(this.device)) {
          throw new Error("Device not connected or not a BLE device");
        }
        const serial = await BleClient.read(
          this.device.deviceId,
          this.DEVICE_INFORMATION_SERVICE_UUID,
          this.SERIAL_NUMBER_UUID
        );
        const serialNumber = new TextDecoder().decode(serial);
        this.serialNumber = serialNumber;
      } else {
        if (!this.serviceDVB) {
          throw new Error("DVB service not available");
        }

        const characteristic = await this.serviceDVB.getCharacteristic(
          this.SERIAL_NUMBER_UUID
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
        if (!this.device || !this.isBleDevice(this.device)) {
          throw new Error("Device not connected or not a BLE device");
        }
        const firmware = await BleClient.read(
          this.device.deviceId,
          this.DEVICE_INFORMATION_SERVICE_UUID,
          this.FIRMWARE_REVISION_UUID
        );
        const firmwareVersion = new TextDecoder().decode(firmware);
        this.logger.info("Firmware Version:", firmwareVersion);
        this.firmwareVersion = firmwareVersion;
      } else {
        if (!this.serviceInfo) {
          throw new Error("Device information service not available");
        }

        const characteristic = await this.serviceInfo.getCharacteristic(
          this.FIRMWARE_REVISION_UUID
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
        if (!this.device || !this.isBleDevice(this.device)) {
          throw new Error("Device not connected or not a BLE device");
        }
        const hardware = await BleClient.read(
          this.device.deviceId,
          this.DEVICE_INFORMATION_SERVICE_UUID,
          this.HARDWARE_REVISION_UUID
        );
        const hardwareVersion = new TextDecoder().decode(hardware);
        this.logger.info("Hardware Version:", hardwareVersion);
        this.hardwareVersion = hardwareVersion;
      } else {
        if (!this.serviceInfo) {
          throw new Error("Device information service not available");
        }

        const characteristic = await this.serviceInfo.getCharacteristic(
          this.HARDWARE_REVISION_UUID
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
        if (!this.device || !this.isBleDevice(this.device)) {
          throw new Error("Device not connected or not a BLE device");
        }
        const duDeviceUID = await BleClient.read(
          this.device.deviceId,
          this.DVB_SERVICE_UUID,
          this.DU_DEVICE_UID_UUID
        );
        const duDeviceUIDString = new TextDecoder().decode(duDeviceUID);
        this.logger.info("DUDeviceUID:", duDeviceUIDString);
        this.duDeviceUIDVersion = duDeviceUIDString;
      } else {
        if (!this.serviceDVB) {
          throw new Error("DVB service not available");
        }

        const characteristic = await this.serviceDVB.getCharacteristic(
          this.DU_DEVICE_UID_UUID
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

  public getDUSerialNumber() {
    return this.duSerialNumber;
  }

  public async readDUSerialNumber() {
    try {
      if (!this.isConnected) {
        throw new Error("Device is not connected");
      }

      // Add a small delay to ensure services are ready
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (Capacitor.isNativePlatform()) {
        if (!this.device || !this.isBleDevice(this.device)) {
          throw new Error("Device not connected or not a BLE device");
        }
        this.logger.info("Reading DU Serial Number from native platform...");
        const duSerialNumber = await BleClient.read(
          this.device.deviceId,
          this.DVB_SERVICE_UUID,
          this.DU_SERIAL_NUMBER_UUID
        );
        const decodedValue = new TextDecoder().decode(duSerialNumber);
        this.logger.info(
          "Raw DU Serial Number value:",
          Array.from(new Uint8Array(duSerialNumber.buffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(" ")
        );
        this.logger.info("Decoded DU Serial Number:", decodedValue);

        if (!decodedValue || decodedValue.trim() === "") {
          throw new Error("Received empty DU Serial Number");
        }

        this.duSerialNumber = decodedValue;
      } else {
        if (!this.serviceDVB) {
          throw new Error("DVB service not available");
        }

        this.logger.info("Reading DU Serial Number from web platform...");
        const characteristic = await this.serviceDVB.getCharacteristic(
          this.DU_SERIAL_NUMBER_UUID
        );
        if (!characteristic) {
          throw new Error("DU Serial Number characteristic not found");
        }

        this.logger.info("DU Serial Number characteristic properties:", {
          read: characteristic.properties.read,
          write: characteristic.properties.write,
          writeWithoutResponse: characteristic.properties.writeWithoutResponse,
          notify: characteristic.properties.notify,
          indicate: characteristic.properties.indicate,
          broadcast: characteristic.properties.broadcast,
          authenticatedSignedWrites:
            characteristic.properties.authenticatedSignedWrites,
          reliableWrite: characteristic.properties.reliableWrite,
          writableAuxiliaries: characteristic.properties.writableAuxiliaries,
        });

        const duSerialNumber = await characteristic.readValue();
        const decodedValue = new TextDecoder().decode(duSerialNumber);
        this.logger.info(
          "Raw DU Serial Number value:",
          Array.from(new Uint8Array(duSerialNumber.buffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(" ")
        );
        this.logger.info("Decoded DU Serial Number:", decodedValue);

        if (!decodedValue || decodedValue.trim() === "") {
          throw new Error("Received empty DU Serial Number");
        }

        this.duSerialNumber = decodedValue;
      }
    } catch (error) {
      this.logger.error("Error reading DU Serial Number:", error);
      this.duSerialNumber = null;
      throw error;
    }
  }

  public getManufacturerSerialNumber() {
    return this.manufacturerSerialNumber;
  }

  public async readManufacturerSerialNumber() {
    try {
      if (!this.isConnected) {
        throw new Error("Device is not connected");
      }

      // Add a small delay to ensure services are ready
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (Capacitor.isNativePlatform()) {
        if (!this.device || !this.isBleDevice(this.device)) {
          throw new Error("Device not connected or not a BLE device");
        }
        this.logger.info(
          "Reading Manufacturer Serial Number from native platform..."
        );
        const manufacturerSerial = await BleClient.read(
          this.device.deviceId,
          this.DVB_SERVICE_UUID,
          this.DU_MANUFACTURER_SERIAL_UUID
        );
        const decodedValue = new TextDecoder().decode(manufacturerSerial);
        this.logger.info(
          "Raw Manufacturer Serial Number value:",
          Array.from(new Uint8Array(manufacturerSerial.buffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(" ")
        );
        this.logger.info("Decoded Manufacturer Serial Number:", decodedValue);
        this.manufacturerSerialNumber = decodedValue;
      } else {
        if (!this.serviceDVB) {
          throw new Error("DVB service not available");
        }

        this.logger.info(
          "Reading Manufacturer Serial Number from web platform..."
        );
        const characteristic = await this.serviceDVB.getCharacteristic(
          this.DU_MANUFACTURER_SERIAL_UUID
        );
        if (!characteristic) {
          throw new Error(
            "Manufacturer Serial Number characteristic not found"
          );
        }

        // Log the characteristic properties for debugging
        this.logger.info(
          "Manufacturer Serial Number characteristic properties:",
          {
            read: characteristic.properties.read,
            write: characteristic.properties.write,
            writeWithoutResponse:
              characteristic.properties.writeWithoutResponse,
            notify: characteristic.properties.notify,
            indicate: characteristic.properties.indicate,
            broadcast: characteristic.properties.broadcast,
            authenticatedSignedWrites:
              characteristic.properties.authenticatedSignedWrites,
            reliableWrite: characteristic.properties.reliableWrite,
            writableAuxiliaries: characteristic.properties.writableAuxiliaries,
          }
        );

        const manufacturerSerial = await characteristic.readValue();
        const decodedValue = new TextDecoder().decode(manufacturerSerial);
        this.logger.info(
          "Raw Manufacturer Serial Number value:",
          Array.from(new Uint8Array(manufacturerSerial.buffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(" ")
        );
        this.logger.info("Decoded Manufacturer Serial Number:", decodedValue);
        this.manufacturerSerialNumber = decodedValue;
      }
    } catch (error) {
      this.logger.error("Error reading Manufacturer Serial Number:", error);
      throw error;
    }
  }

  private readonly MAC_KEY = new Uint8Array([
    0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 77,
    0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF
  ]);

  private async calculateSHA3Signature(serialNumber: string, randomValue: Uint8Array): Promise<Uint8Array> {
    try {
      // Convert serial number hex string to bytes if needed
      let serialBytes: Uint8Array;
      if (serialNumber.length === 24) { // 96-bit = 24 hex chars
        serialBytes = new Uint8Array(12); // 96 bits = 12 bytes
        for (let i = 0; i < 12; i++) {
          const byteHex = serialNumber.substring(i * 2, i * 2 + 2);
          serialBytes[i] = parseInt(byteHex, 16);
        }
      } else {
        throw new Error(`Invalid serial number format: ${serialNumber}`);
      }
      
      // Concatenate all bytes for SHA3 calculation
      const dataToSign = new Uint8Array(32);
      // First 16 bytes: MAC key
      dataToSign.set(this.MAC_KEY, 0);
      // Next 12 bytes: Serial Number
      dataToSign.set(serialBytes, 16);
      // Last 4 bytes: Random Value
      dataToSign.set(randomValue, 28);
      
      this.logger.info("Data prepared for signing:", 
        Array.from(dataToSign).map(b => b.toString(16).padStart(2, '0')).join(' '));
      
      // Calculate SHA3-256 hash
      const hashBuffer = await crypto.subtle.digest('SHA3-256', dataToSign);
      this.logger.info("converted into sha3-256",hashBuffer);
      const hashArray = new Uint8Array(hashBuffer);
      
      // Return only first 4 bytes of hash as signature
      return hashArray.slice(0, 4);
    } catch (error) {
      this.logger.error("Error calculating SHA3 signature:", error);
      throw error;
    }
  }

  public async verifyDevice(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        throw new Error("Device is not connected");
      }
  
      // First read the DU Serial Number
      await this.readDUSerialNumber();
      const serialNumber = this.getDUSerialNumber();
      if (!serialNumber) {
        throw new Error("Failed to read DU Serial Number");
      }
  
      this.logger.info("DU Serial Number for verification:", serialNumber);
  
      // Generate random value (4 bytes)
      const randomValue = new Uint8Array(4);
      crypto.getRandomValues(randomValue);
      this.logger.info(
        "Generated random value:",
        Array.from(randomValue)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" ")
      );
  
      // Write random value to DU
      if (Capacitor.isNativePlatform()) {
        if (!this.device || !this.isBleDevice(this.device)) {
          throw new Error("Device not connected or not a BLE device");
        }
        await BleClient.write(
          this.device.deviceId,
          this.DVB_SERVICE_UUID,
          this.DU_SERVER_REGISTRATION_UUID,
          new DataView(randomValue.buffer)
        );
      } else {
        if (!this.serviceDVB) {
          throw new Error("DVB service not available");
        }
  
        const characteristic = await this.serviceDVB.getCharacteristic(
          this.DU_SERVER_REGISTRATION_UUID
        );
        if (!characteristic) {
          throw new Error("Server Registration characteristic not found");
        }
  
        if (
          !characteristic.properties.write &&
          !characteristic.properties.writeWithoutResponse
        ) {
          throw new Error("Characteristic does not support writing");
        }
  
        if (characteristic.properties.writeWithoutResponse) {
          await characteristic.writeValueWithoutResponse(randomValue);
        } else {
          await characteristic.writeValue(randomValue);
        }
      }
  
      // Read back the response signature
      let response;
      if (Capacitor.isNativePlatform()) {
        if (!this.device || !this.isBleDevice(this.device)) {
          throw new Error("Device not connected or not a BLE device");
        }
        response = await BleClient.read(
          this.device.deviceId,
          this.DVB_SERVICE_UUID,
          this.DU_SERVER_REGISTRATION_UUID
        );
      } else {
        if (!this.serviceDVB) {
          throw new Error("DVB service not available");
        }
  
        const characteristic = await this.serviceDVB.getCharacteristic(
          this.DU_SERVER_REGISTRATION_UUID
        );
        response = await characteristic.readValue();
      }
  
      // Calculate expected signature based on document specification
      const expectedSignature = await this.calculateSHA3Signature(
        serialNumber,
        randomValue
      );
  
      // Compare signatures
      const responseArray = new Uint8Array(response.buffer);
  
      if (responseArray.length !== 4) {
        this.logger.error(
          `Invalid signature length: ${responseArray.length} (expected 4)`
        );
        return false;
      }
  
      const isVerified = responseArray.every(
        (byte, index) => byte === expectedSignature[index]
      );
  
      if (isVerified) {
        this.logger.info("Device verification successful!");
      } else {
        this.logger.error("Device verification failed! Signatures don't match.");
        this.logger.error(
          "Expected:", 
          Array.from(expectedSignature).map(b => b.toString(16).padStart(2, '0')).join(' ')
        );
        this.logger.error(
          "Received:", 
          Array.from(responseArray).map(b => b.toString(16).padStart(2, '0')).join(' ')
        );
      }
  
      return isVerified;
    } catch (error) {
      this.logger.error("Error during device verification:", error);
      throw error;
    }
  }

  public async calibrateAccel() {
    try {
      if (!this.isConnected) {
        throw new Error("Device is not connected");
      }

      const command = new Uint8Array([0x10]);

      if (Capacitor.isNativePlatform()) {
        if (!this.device || !this.isBleDevice(this.device)) {
          throw new Error("Device not connected or not a BLE device");
        }
        await BleClient.write(
          this.device.deviceId,
          this.DVB_SERVICE_UUID,
          this.DU_SENSOR_SETTING_UUID,
          new DataView(command.buffer)
        );
      } else {
        if (!this.serviceDVB) {
          throw new Error("DVB service not available");
        }

        const characteristic = await this.serviceDVB.getCharacteristic(
          this.DU_SENSOR_SETTING_UUID
        );
        if (!characteristic) {
          throw new Error("Sensor Setting characteristic not found");
        }

        if (
          !characteristic.properties.write &&
          !characteristic.properties.writeWithoutResponse
        ) {
          throw new Error("Characteristic does not support writing");
        }

        if (characteristic.properties.writeWithoutResponse) {
          await characteristic.writeValueWithoutResponse(command);
        } else {
          await characteristic.writeValue(command);
        }
      }

      this.logger.info("ACCEL calibration command sent successfully");
    } catch (error) {
      this.logger.error("Error sending ACCEL calibration command", error);
      throw error;
    }
  }

  public async calibrateMagn() {
    try {
      if (!this.isConnected) {
        throw new Error("Device is not connected");
      }

      const command = new Uint8Array([0x11]);

      if (Capacitor.isNativePlatform()) {
        if (!this.device || !this.isBleDevice(this.device)) {
          throw new Error("Device not connected or not a BLE device");
        }
        await BleClient.write(
          this.device.deviceId,
          this.DVB_SERVICE_UUID,
          this.DU_SENSOR_SETTING_UUID,
          new DataView(command.buffer)
        );
      } else {
        if (!this.serviceDVB) {
          throw new Error("DVB service not available");
        }

        const characteristic = await this.serviceDVB.getCharacteristic(
          this.DU_SENSOR_SETTING_UUID
        );
        if (!characteristic) {
          throw new Error("Sensor Setting characteristic not found");
        }

        if (
          !characteristic.properties.write &&
          !characteristic.properties.writeWithoutResponse
        ) {
          throw new Error("Characteristic does not support writing");
        }

        if (characteristic.properties.writeWithoutResponse) {
          await characteristic.writeValueWithoutResponse(command);
        } else {
          await characteristic.writeValue(command);
        }
      }

      this.logger.info("MAGN calibration command sent successfully");
    } catch (error) {
      this.logger.error("Error sending MAGN calibration command", error);
      throw error;
    }
  }

  public async testHardware() {
    try {
      if (!this.isConnected) {
        throw new Error("Device is not connected");
      }

      const command = new Uint8Array([0x20]);

      if (Capacitor.isNativePlatform()) {
        if (!this.device || !this.isBleDevice(this.device)) {
          throw new Error("Device not connected or not a BLE device");
        }
        await BleClient.write(
          this.device.deviceId,
          this.DVB_SERVICE_UUID,
          this.DU_SENSOR_SETTING_UUID,
          new DataView(command.buffer)
        );
      } else {
        if (!this.serviceDVB) {
          throw new Error("DVB service not available");
        }

        const characteristic = await this.serviceDVB.getCharacteristic(
          this.DU_SENSOR_SETTING_UUID
        );
        if (!characteristic) {
          throw new Error("Sensor Setting characteristic not found");
        }

        if (
          !characteristic.properties.write &&
          !characteristic.properties.writeWithoutResponse
        ) {
          throw new Error("Characteristic does not support writing");
        }

        if (characteristic.properties.writeWithoutResponse) {
          await characteristic.writeValueWithoutResponse(command);
        } else {
          await characteristic.writeValue(command);
        }
      }

      this.logger.info("Hardware test command sent successfully");
    } catch (error) {
      this.logger.error("Error sending hardware test command", error);
      throw error;
    }
  }
}
