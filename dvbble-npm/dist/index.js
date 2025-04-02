"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bluetooth_le_1 = require("@capacitor-community/bluetooth-le");
const core_1 = require("@capacitor/core");
const cbor_1 = __importDefault(require("cbor"));
class DVBDeviceBLE {
    constructor() {
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.userRequestedDisconnect = false;
        this.SERVICE_UUID = "8d53dc1d-1db7-4cd3-868b-8a527460aa84";
        this.CHARACTERISTIC_UUID = "da2e7828-fbce-4e01-ae9e-261174997c48";
        this.mtu = 140;
        this.device = null;
        this.service = null;
        this.characteristic = null;
        this.connectCallback = null;
        this.connectingCallback = null;
        this.disconnectCallback = null;
        this.messageCallback = null;
        this.imageUploadProgressCallback = null;
        this.imageUploadFinishedCallback = null;
        this.buffer = new Uint8Array();
        this.logger = { info: console.log, error: console.error };
        this.seq = 0;
        this.uploadImage = null;
        this.uploadOffset = 0;
        this.uploadSlot = 0;
        this.uploadIsInProgress = false;
        this.duSerialNumber = null;
        this.isRegistered = false;
        // DVB
        this.serviceDVB = null;
        this.serviceInfo = null;
        this.listOfFiles = [];
        this.shortname = null;
        this.serialNumber = null;
        this.firmwareVersion = null;
        this.hardwareVersion = null;
        this.duDeviceUIDVersion = null;
        // Serials
        this.DEVICE_INFORMATION_SERVICE_UUID = "0000180a-0000-1000-8000-00805f9b34fb";
        this.SERIAL_NUMBER_UUID = "dbd00001-ff30-40a5-9ceb-a17358d31999";
        this.FIRMWARE_REVISION_UUID = "00002a26-0000-1000-8000-00805f9b34fb";
        this.HARDWARE_REVISION_UUID = "00002a27-0000-1000-8000-00805f9b34fb";
        this.DVB_SERVICE_UUID = "dbd00001-ff30-40a5-9ceb-a17358d31999";
        this.LIST_FILES_UUID = "dbd00010-ff30-40a5-9ceb-a17358d31999";
        this.WRITE_TO_DEVICE_UUID = "dbd00011-ff30-40a5-9ceb-a17358d31999";
        this.READ_FROM_DEVICE_UUID = "dbd00012-ff30-40a5-9ceb-a17358d31999";
        this.FORMAT_STORAGE_UUID = "dbd00013-ff30-40a5-9ceb-a17358d31999";
        this.SHORTNAME_UUID = "dbd00002-ff30-40a5-9ceb-a17358d31999";
        this.DU_SHORTNAME_UUID = "dbd00002-ff30-40a5-9ceb-a17358d31999";
        this.DU_DEVICE_UID_UUID = "dbd00003-ff30-40a5-9ceb-a17358d31999";
        this.DU_SERIAL_NUMBER_UUID = "dbd00001-ff30-40a5-9ceb-a17358d31999";
        this.DU_SERVER_REGISTRATION_UUID = "dbd00006-ff30-40a5-9ceb-a17358d31999";
        this.DU_MANUFACTURER_SERIAL_UUID = "dbd00008-ff30-40a5-9ceb-a17358d31999";
        this.DU_SENSOR_SETTING_UUID = "dbd00007-ff30-40a5-9ceb-a17358d31999";
        this.manufacturerSerialNumber = null;
    }
    async requestBrowserDevice() {
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
    async requestMobileDevice() {
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
            bluetooth_le_1.BleClient.requestLEScan(params, (result) => {
                if (result.localName) {
                    bluetooth_le_1.BleClient.stopLEScan();
                    resolve({
                        deviceId: result.device.deviceId,
                        name: result.localName,
                    });
                }
            }).catch(reject);
            setTimeout(() => {
                bluetooth_le_1.BleClient.stopLEScan();
                reject(new Error("Scan timeout"));
            }, 10000);
        });
    }
    isBleDevice(device) {
        return "deviceId" in device;
    }
    isBluetoothDevice(device) {
        return "gatt" in device;
    }
    getDeviceDisplayName(device) {
        if (!device)
            return "Unknown Device";
        return this.isBleDevice(device)
            ? device.name || device.deviceId
            : device.name || "Unknown Device";
    }
    async connect() {
        var _a;
        if (core_1.Capacitor.isNativePlatform()) {
            try {
                this.device = await this.requestMobileDevice();
                this.logger.info(`Connecting to device ${this.getDeviceDisplayName(this.device)}...`);
                await bluetooth_le_1.BleClient.connect(this.device.deviceId);
                this.logger.info(`Connected to device ${this.getDeviceDisplayName(this.device)}`);
                // Wait for services to be discovered
                await new Promise(resolve => setTimeout(resolve, 1000));
                await bluetooth_le_1.BleClient.startNotifications(this.device.deviceId, this.SERVICE_UUID, this.CHARACTERISTIC_UUID, (value) => {
                    this.notification({ target: { value } });
                });
                this.isConnected = true;
            }
            catch (error) {
                this.logger.error(`Connection error: ${error instanceof Error ? error.message : String(error)}`);
                this.isConnected = false;
                await this.disconnected();
                throw error;
            }
        }
        else {
            try {
                this.device = (await this.requestBrowserDevice());
                if (!this.device) {
                    throw new Error("Failed to get device");
                }
                this.device.addEventListener("gattserverdisconnected", this.handleDisconnect.bind(this));
                this.logger.info(`Connecting to device ${this.getDeviceDisplayName(this.device)}...`);
                const server = await ((_a = this.device.gatt) === null || _a === void 0 ? void 0 : _a.connect());
                if (!server) {
                    throw new Error("Failed to connect to GATT server");
                }
                this.logger.info("Server connected.");
                // Get all required services with retries
                const getServiceWithRetry = async (uuid, retries = 3) => {
                    for (let i = 0; i < retries; i++) {
                        try {
                            const service = await server.getPrimaryService(uuid);
                            if (service)
                                return service;
                            //eslint-disable-next-line @typescript-eslint/no-unused-vars
                        }
                        catch (error) {
                            this.logger.info(`Retry ${i + 1} getting service ${uuid}`);
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                    throw new Error(`Failed to get service ${uuid} after ${retries} retries`);
                };
                // Get all services in parallel
                const [serviceResult, serviceDVBResult, serviceInfoResult] = await Promise.all([
                    getServiceWithRetry(this.SERVICE_UUID),
                    getServiceWithRetry(this.DVB_SERVICE_UUID),
                    getServiceWithRetry(this.DEVICE_INFORMATION_SERVICE_UUID)
                ]);
                this.service = serviceResult;
                this.serviceDVB = serviceDVBResult;
                this.serviceInfo = serviceInfoResult;
                if (!this.serviceDVB) {
                    throw new Error("DVB service not found");
                }
                // Get characteristic with retries
                const getCharacteristicWithRetry = async (service, uuid, retries = 3) => {
                    for (let i = 0; i < retries; i++) {
                        try {
                            const characteristic = await service.getCharacteristic(uuid);
                            if (characteristic)
                                return characteristic;
                            //eslint-disable-next-line @typescript-eslint/no-unused-vars
                        }
                        catch (error) {
                            this.logger.info(`Retry ${i + 1} getting characteristic ${uuid}`);
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                    throw new Error(`Failed to get characteristic ${uuid} after ${retries} retries`);
                };
                // Get main characteristic
                const characteristicResult = await getCharacteristicWithRetry(this.service, this.CHARACTERISTIC_UUID);
                this.characteristic = characteristicResult;
                if (this.characteristic) {
                    this.characteristic.addEventListener("characteristicvaluechanged", this.notification.bind(this));
                    await this.characteristic.startNotifications();
                }
                // Wait a bit to ensure everything is ready
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.isConnected = true;
            }
            catch (error) {
                this.logger.error(`Connection error: ${error instanceof Error ? error.message : String(error)}`);
                this.isConnected = false;
                await this.disconnected();
                throw error;
            }
        }
        if (this.connectingCallback)
            this.connectingCallback();
        this.logger.info("Service connected.");
        this.isConnected = true;
        await this.connected();
        if (this.uploadIsInProgress) {
            this.uploadNext();
        }
    }
    getDeviceName() {
        var _a;
        return (_a = this.device) === null || _a === void 0 ? void 0 : _a.name;
    }
    async setDeviceInfo() {
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
        }
        catch (error) {
            this.logger.error(`Error setting device info: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async handleDisconnect(event) {
        this.logger.info("Device disconnected", event);
        this.isConnected = false;
        if (!this.userRequestedDisconnect) {
            this.logger.info("Attempting to reconnect...");
            this.reconnectAttempts = 0;
            this.reconnect();
        }
        else {
            console.log("User requested disconnect");
            await this.disconnected();
        }
    }
    async reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error("Max reconnection attempts reached. Please try connecting manually.");
            await this.disconnected();
            return;
        }
        this.reconnectAttempts++;
        this.logger.info(`Reconnection attempt ${this.reconnectAttempts}...`);
        try {
            await this.connect();
        }
        catch (error) {
            this.logger.error(`Reconnection error: ${error instanceof Error ? error.message : String(error)}`);
            setTimeout(() => this.reconnect(), 2000);
        }
    }
    disconnect() {
        var _a;
        this.userRequestedDisconnect = true;
        if (core_1.Capacitor.isNativePlatform()) {
            if (!this.device || !this.isBleDevice(this.device)) {
                return Promise.resolve();
            }
            return bluetooth_le_1.BleClient.disconnect(this.device.deviceId);
        }
        else {
            if (!this.device || !this.isBluetoothDevice(this.device)) {
                return Promise.resolve();
            }
            return (_a = this.device.gatt) === null || _a === void 0 ? void 0 : _a.disconnect();
        }
    }
    onConnecting(callback) {
        this.connectingCallback = callback;
        return this;
    }
    onConnect(callback) {
        this.connectCallback = callback;
        return this;
    }
    onDisconnect(callback) {
        this.disconnectCallback = callback;
        return this;
    }
    onMessage(callback) {
        this.messageCallback = callback;
        return this;
    }
    onImageUploadProgress(callback) {
        this.imageUploadProgressCallback = callback;
        return this;
    }
    onImageUploadFinished(callback) {
        this.imageUploadFinishedCallback = callback;
        return this;
    }
    async connected() {
        this.userRequestedDisconnect = false;
        if (this.connectCallback)
            this.connectCallback();
    }
    async disconnected() {
        this.logger.info("Disconnected.");
        if (this.disconnectCallback)
            this.disconnectCallback();
        this.device = null;
        this.service = null;
        this.serviceDVB = null;
        this.serviceInfo = null;
        this.characteristic = null;
        this.uploadIsInProgress = false;
        this.serialNumber = null;
        this.listOfFiles = [];
    }
    async sendMessage(op, group, id, data) {
        const _flags = 0;
        let encodedData = [];
        if (typeof data !== "undefined") {
            encodedData = [...new Uint8Array(cbor_1.default.encode(data))];
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
        this.logger.info(`Sending message: op=${op}, group=${group}, id=${id}, length=${encodedData.length}`);
        if (core_1.Capacitor.isNativePlatform()) {
            if (!this.device || !this.isBleDevice(this.device)) {
                throw new Error("Device not connected or not a BLE device");
            }
            const messageArray = Uint8Array.from(message);
            await bluetooth_le_1.BleClient.writeWithoutResponse(this.device.deviceId, this.SERVICE_UUID, this.CHARACTERISTIC_UUID, new DataView(messageArray.buffer));
        }
        else {
            if (!this.characteristic) {
                throw new Error("Characteristic not available");
            }
            await this.characteristic.writeValueWithoutResponse(Uint8Array.from(message));
        }
        this.seq = (this.seq + 1) % 256;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    notification(event) {
        console.log("message received");
        const message = new Uint8Array(event.target.value.buffer);
        this.buffer = new Uint8Array([...this.buffer, ...message]);
        const messageLength = this.buffer[2] * 256 + this.buffer[3];
        if (this.buffer.length < messageLength + 8)
            return;
        this.processMessage(this.buffer.slice(0, messageLength + 8));
        this.buffer = this.buffer.slice(messageLength + 8);
    }
    processMessage(message) {
        const [op, _flags, length_hi, length_lo, group_hi, group_lo, _seq, id] = message;
        void _flags;
        void _seq;
        const data = cbor_1.default.decode(message.slice(8).buffer);
        const length = length_hi * 256 + length_lo;
        const group = group_hi * 256 + group_lo;
        this.logger.info(`Processing message - op: ${op}, group: ${group}, id: ${id}, data:`, data);
        if (group === 1 && id === 1) {
            if (data.rc === 0 || data.rc === undefined) {
                if (data.off !== undefined) {
                    this.uploadOffset = data.off;
                    this.logger.info(`Upload offset updated to: ${this.uploadOffset}`);
                    this.uploadNext();
                }
            }
            else {
                this.logger.error(`Upload error received: rc=${data.rc}`);
                this.uploadIsInProgress = false;
                if (this.imageUploadFinishedCallback) {
                    this.imageUploadFinishedCallback();
                }
            }
            return;
        }
        if (this.messageCallback)
            this.messageCallback({ op, group, id, data, length });
    }
    cmdReset() {
        return this.sendMessage(2, 0, 5);
    }
    smpEcho(message) {
        return this.sendMessage(2, 0, 0, { d: message });
    }
    cmdImageState() {
        return this.sendMessage(0, 1, 0);
    }
    cmdImageErase() {
        return this.sendMessage(2, 1, 5, {});
    }
    cmdImageTest(hash) {
        return this.sendMessage(2, 1, 0, {
            hash,
            confirm: false,
        });
    }
    cmdImageConfirm(hash) {
        return this.sendMessage(2, 1, 0, {
            hash,
            confirm: true,
        });
    }
    hash(image) {
        return crypto.subtle.digest("SHA-256", image);
    }
    async uploadNext() {
        if (!this.uploadImage) {
            this.logger.info("No image to upload");
            this.uploadIsInProgress = false;
            return;
        }
        if (this.uploadOffset >= this.uploadImage.byteLength) {
            this.logger.info("Upload complete - reached end of image");
            this.uploadIsInProgress = false;
            if (this.imageUploadFinishedCallback) {
                this.imageUploadFinishedCallback();
            }
            return;
        }
        const nmpOverhead = 8;
        const message = { data: new Uint8Array(), off: this.uploadOffset };
        if (this.uploadOffset === 0) {
            this.logger.info(`Starting upload of ${this.uploadImage.byteLength} bytes`);
            message.len = this.uploadImage.byteLength;
            message.sha = new Uint8Array(await this.hash(this.uploadImage));
            this.logger.info("Image hash:", Array.from(message.sha).map(b => b.toString(16).padStart(2, '0')).join(' '));
        }
        // Calculate progress percentage
        const progress = Math.floor((this.uploadOffset / this.uploadImage.byteLength) * 100);
        if (this.imageUploadProgressCallback) {
            this.imageUploadProgressCallback({ percentage: progress });
        }
        const length = this.mtu - cbor_1.default.encode(message).byteLength - nmpOverhead;
        message.data = new Uint8Array(this.uploadImage.slice(this.uploadOffset, this.uploadOffset + length));
        this.logger.info(`Sending chunk at offset ${this.uploadOffset}, length ${message.data.length} bytes`);
        this.uploadOffset += length;
        try {
            await this.sendMessage(2, 1, 1, message);
            this.logger.info("Chunk sent successfully");
        }
        catch (error) {
            this.logger.error("Error during upload:", error);
            this.uploadIsInProgress = false;
            throw error;
        }
    }
    async cmdUpload(image, slot = 0) {
        if (this.uploadIsInProgress) {
            this.logger.error("Upload is already in progress.");
            return;
        }
        this.logger.info(`Starting firmware upload to slot ${slot}`);
        this.uploadIsInProgress = true;
        this.uploadOffset = 0;
        this.uploadImage = image;
        this.uploadSlot = slot;
        try {
            // First, send the image upload command
            this.logger.info("Sending image upload command...");
            await this.sendMessage(2, 1, 2, {
                slot,
                size: image.byteLength,
                hash: new Uint8Array(await this.hash(image))
            });
            // Wait a bit for the device to process
            await new Promise(resolve => setTimeout(resolve, 500));
            // Then start sending the actual data chunks
            this.logger.info("Starting to send image data chunks...");
            await this.uploadNext();
        }
        catch (error) {
            this.logger.error("Error during upload initialization:", error);
            this.uploadIsInProgress = false;
            throw error;
        }
    }
    async imageInfo(image) {
        const info = { version: "", hash: new Uint8Array() };
        const buffer = ArrayBuffer.isView(image) ? image.buffer : image;
        const view = new Uint8Array(buffer);
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
    getShortName() {
        return this.shortname;
    }
    async setShortName(shortname) {
        try {
            if (core_1.Capacitor.isNativePlatform()) {
                if (!this.device || !this.isBleDevice(this.device)) {
                    throw new Error("Device not connected or not a BLE device");
                }
                if (!this.serviceDVB) {
                    throw new Error("DVB service not available");
                }
                if (!shortname) {
                    const result = await bluetooth_le_1.BleClient.read(this.device.deviceId, this.DVB_SERVICE_UUID, this.SHORTNAME_UUID);
                    this.shortname = new TextDecoder().decode(result);
                }
                else {
                    const uf8encode = new TextEncoder();
                    const newShortName = uf8encode.encode(shortname);
                    await bluetooth_le_1.BleClient.write(this.device.deviceId, this.DVB_SERVICE_UUID, this.SHORTNAME_UUID, new DataView(newShortName.buffer));
                    this.shortname = shortname;
                }
            }
            else {
                if (!this.serviceDVB) {
                    throw new Error("DVB service not available");
                }
                if (!shortname) {
                    const characteristic = await this.serviceDVB.getCharacteristic(this.SHORTNAME_UUID);
                    const value = await characteristic.readValue();
                    this.shortname = new TextDecoder().decode(value);
                }
                else {
                    const characteristic = await this.serviceDVB.getCharacteristic(this.SHORTNAME_UUID);
                    const uf8encode = new TextEncoder();
                    const newShortName = uf8encode.encode(shortname);
                    await characteristic.writeValue(newShortName);
                    this.shortname = shortname;
                }
            }
        }
        catch (error) {
            this.logger.error(error);
        }
    }
    getFileList() {
        return this.listOfFiles;
    }
    async setFileList() {
        if (!this.isConnected) {
            this.logger.error("Device is not connected. Cannot set file list.");
            return;
        }
        try {
            if (core_1.Capacitor.isNativePlatform()) {
                if (!this.device || !this.isBleDevice(this.device)) {
                    throw new Error("Device not connected or not a BLE device");
                }
                while (true) {
                    const value = await bluetooth_le_1.BleClient.read(this.device.deviceId, this.DVB_SERVICE_UUID, this.LIST_FILES_UUID);
                    const message = new Uint8Array(value.buffer);
                    if (message.byteLength === 0)
                        return;
                    const byteString = String.fromCharCode(...message);
                    const split_string = byteString.split(";");
                    const name = split_string[0];
                    const length = split_string[1];
                    this.listOfFiles.push({ name, length });
                }
            }
            else {
                if (!this.serviceDVB) {
                    throw new Error("DVB service not available");
                }
                while (true) {
                    const characteristic = await this.serviceDVB.getCharacteristic(this.LIST_FILES_UUID);
                    const value = await characteristic.readValue();
                    const message = new Uint8Array(value.buffer);
                    if (message.byteLength === 0)
                        return;
                    const byteString = String.fromCharCode(...message);
                    const split_string = byteString.split(";");
                    const name = split_string[0];
                    const length = split_string[1];
                    this.listOfFiles.push({ name, length });
                }
            }
        }
        catch (error) {
            if (error instanceof Error) {
                this.logger.error(`Error setting file list: ${error.message}`);
            }
            else {
                this.logger.error(`Error setting file list: ${error}`);
            }
        }
    }
    async getFileContent(name, progressCallback) {
        try {
            const arrayBuffers = [];
            let offset = 0;
            let totalSize = 0;
            const CHUNK_SIZE = 65536;
            const fileInfo = this.listOfFiles.find((file) => file.name === name);
            if (fileInfo) {
                totalSize = parseInt(fileInfo.length);
            }
            const utf8encoder = new TextEncoder();
            if (core_1.Capacitor.isNativePlatform()) {
                if (!this.device || !this.isBleDevice(this.device)) {
                    throw new Error("Device not connected or not a BLE device");
                }
                while (true) {
                    try {
                        const name_bytes = utf8encoder.encode(`${name};${offset};`);
                        await bluetooth_le_1.BleClient.write(this.device.deviceId, this.DVB_SERVICE_UUID, this.WRITE_TO_DEVICE_UUID, new DataView(name_bytes.buffer));
                        const display_info = await bluetooth_le_1.BleClient.read(this.device.deviceId, this.DVB_SERVICE_UUID, this.READ_FROM_DEVICE_UUID);
                        if (display_info.byteLength !== 0) {
                            const array = new Uint8Array(display_info.buffer);
                            array.map((x) => arrayBuffers.push(x));
                            if (arrayBuffers.length % CHUNK_SIZE === 0) {
                                offset += CHUNK_SIZE;
                                this.logger.info(`Reached 64 KB, updating offset: ${offset}`);
                            }
                            if (totalSize > 0 && progressCallback) {
                                const progress = Math.min(100, Math.round((arrayBuffers.length / totalSize) * 100));
                                progressCallback(progress);
                            }
                        }
                        else {
                            break;
                        }
                    }
                    catch (error) {
                        this.logger.error(`Error reading data, retrying at offset ${offset}`, error);
                        await new Promise((resolve) => setTimeout(resolve, 500)); // Small delay before retrying
                    }
                }
            }
            else {
                if (!this.serviceDVB) {
                    throw new Error("DVB service not available");
                }
                const write_characteristic = await this.serviceDVB.getCharacteristic(this.WRITE_TO_DEVICE_UUID);
                const read_characteristic = await this.serviceDVB.getCharacteristic(this.READ_FROM_DEVICE_UUID);
                while (true) {
                    try {
                        if (arrayBuffers.length % CHUNK_SIZE === 0) {
                            const name_bytes = utf8encoder.encode(`${name};${offset};`);
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
                                const progress = Math.min(100, Math.round((arrayBuffers.length / totalSize) * 100));
                                progressCallback(progress);
                            }
                        }
                        else {
                            break;
                        }
                    }
                    catch (error) {
                        this.logger.error(`Error reading data, retrying at offset ${offset}`, error);
                        await new Promise((resolve) => setTimeout(resolve, 500));
                    }
                }
            }
            return new Uint8Array(arrayBuffers);
        }
        catch (error) {
            this.logger.error(error);
        }
    }
    async formatStorage() {
        try {
            if (core_1.Capacitor.isNativePlatform()) {
                if (!this.device || !this.isBleDevice(this.device)) {
                    throw new Error("Device not connected or not a BLE device");
                }
                await bluetooth_le_1.BleClient.read(this.device.deviceId, this.DVB_SERVICE_UUID, this.FORMAT_STORAGE_UUID);
            }
            else {
                if (!this.serviceDVB) {
                    throw new Error("DVB service not available");
                }
                const characteristic = await this.serviceDVB.getCharacteristic(this.FORMAT_STORAGE_UUID);
                await characteristic.readValue();
            }
            this.logger.info("Files erased");
        }
        catch (error) {
            this.logger.error(error);
        }
    }
    getSerialNumber() {
        return this.serialNumber;
    }
    async setSerialNumber() {
        try {
            if (core_1.Capacitor.isNativePlatform()) {
                if (!this.device || !this.isBleDevice(this.device)) {
                    throw new Error("Device not connected or not a BLE device");
                }
                const serial = await bluetooth_le_1.BleClient.read(this.device.deviceId, this.DEVICE_INFORMATION_SERVICE_UUID, this.SERIAL_NUMBER_UUID);
                const serialNumber = new TextDecoder().decode(serial);
                this.serialNumber = serialNumber;
            }
            else {
                if (!this.serviceDVB) {
                    throw new Error("DVB service not available");
                }
                const characteristic = await this.serviceDVB.getCharacteristic(this.SERIAL_NUMBER_UUID);
                const serial = await characteristic.readValue();
                const serialNumber = new TextDecoder().decode(serial);
                this.serialNumber = serialNumber;
                this.logger.info(`Serial Number: ${this.serialNumber}`);
            }
        }
        catch (error) {
            this.logger.error(error);
        }
    }
    getFirmwareVersion() {
        return this.firmwareVersion;
    }
    async setFirmwareVersion() {
        try {
            if (core_1.Capacitor.isNativePlatform()) {
                if (!this.device || !this.isBleDevice(this.device)) {
                    throw new Error("Device not connected or not a BLE device");
                }
                const firmware = await bluetooth_le_1.BleClient.read(this.device.deviceId, this.DEVICE_INFORMATION_SERVICE_UUID, this.FIRMWARE_REVISION_UUID);
                const firmwareVersion = new TextDecoder().decode(firmware);
                this.logger.info("Firmware Version:", firmwareVersion);
                this.firmwareVersion = firmwareVersion;
            }
            else {
                if (!this.serviceInfo) {
                    throw new Error("Device information service not available");
                }
                const characteristic = await this.serviceInfo.getCharacteristic(this.FIRMWARE_REVISION_UUID);
                const firmware = await characteristic.readValue();
                const firmwareVersion = new TextDecoder().decode(firmware);
                this.logger.info("Firmware Version:", firmwareVersion);
                this.firmwareVersion = firmwareVersion;
            }
        }
        catch (error) {
            this.logger.error("Error getting firmware version:", error);
            throw error;
        }
    }
    getHardwareVersion() {
        return this.hardwareVersion;
    }
    async setHardwareVersion() {
        try {
            if (core_1.Capacitor.isNativePlatform()) {
                if (!this.device || !this.isBleDevice(this.device)) {
                    throw new Error("Device not connected or not a BLE device");
                }
                const hardware = await bluetooth_le_1.BleClient.read(this.device.deviceId, this.DEVICE_INFORMATION_SERVICE_UUID, this.HARDWARE_REVISION_UUID);
                const hardwareVersion = new TextDecoder().decode(hardware);
                this.logger.info("Hardware Version:", hardwareVersion);
                this.hardwareVersion = hardwareVersion;
            }
            else {
                if (!this.serviceInfo) {
                    throw new Error("Device information service not available");
                }
                const characteristic = await this.serviceInfo.getCharacteristic(this.HARDWARE_REVISION_UUID);
                const hardware = await characteristic.readValue();
                const hardwareVersion = new TextDecoder().decode(hardware);
                this.logger.info("Hardware Version:", hardwareVersion);
                this.hardwareVersion = hardwareVersion;
            }
        }
        catch (error) {
            this.logger.error("Error getting firmware version:", error);
            throw error;
        }
    }
    getDUDeviceUID() {
        return this.duDeviceUIDVersion;
    }
    async setDUDeviceUID() {
        try {
            if (core_1.Capacitor.isNativePlatform()) {
                if (!this.device || !this.isBleDevice(this.device)) {
                    throw new Error("Device not connected or not a BLE device");
                }
                const duDeviceUID = await bluetooth_le_1.BleClient.read(this.device.deviceId, this.DVB_SERVICE_UUID, this.DU_DEVICE_UID_UUID);
                const duDeviceUIDString = new TextDecoder().decode(duDeviceUID);
                this.logger.info("DUDeviceUID:", duDeviceUIDString);
                this.duDeviceUIDVersion = duDeviceUIDString;
            }
            else {
                if (!this.serviceDVB) {
                    throw new Error("DVB service not available");
                }
                const characteristic = await this.serviceDVB.getCharacteristic(this.DU_DEVICE_UID_UUID);
                const duDeviceUID = await characteristic.readValue();
                const duDeviceUIDVersion = new TextDecoder().decode(duDeviceUID);
                this.logger.info("DU Device UID Version:", duDeviceUIDVersion);
                this.duDeviceUIDVersion = duDeviceUIDVersion;
            }
        }
        catch (error) {
            this.logger.error("Error getting DUDeviceUID", error);
            throw error;
        }
    }
    getDUSerialNumber() {
        return this.duSerialNumber;
    }
    async readDUSerialNumber() {
        try {
            if (!this.isConnected) {
                throw new Error("Device is not connected");
            }
            // Add a small delay to ensure services are ready
            await new Promise(resolve => setTimeout(resolve, 500));
            if (core_1.Capacitor.isNativePlatform()) {
                if (!this.device || !this.isBleDevice(this.device)) {
                    throw new Error("Device not connected or not a BLE device");
                }
                this.logger.info("Reading DU Serial Number from native platform...");
                const duSerialNumber = await bluetooth_le_1.BleClient.read(this.device.deviceId, this.DVB_SERVICE_UUID, this.DU_SERIAL_NUMBER_UUID);
                const decodedValue = new TextDecoder().decode(duSerialNumber);
                this.logger.info("Raw DU Serial Number value:", Array.from(new Uint8Array(duSerialNumber.buffer)).map(b => b.toString(16).padStart(2, '0')).join(' '));
                this.logger.info("Decoded DU Serial Number:", decodedValue);
                if (!decodedValue || decodedValue.trim() === '') {
                    throw new Error("Received empty DU Serial Number");
                }
                this.duSerialNumber = decodedValue;
            }
            else {
                if (!this.serviceDVB) {
                    throw new Error("DVB service not available");
                }
                this.logger.info("Reading DU Serial Number from web platform...");
                const characteristic = await this.serviceDVB.getCharacteristic(this.DU_SERIAL_NUMBER_UUID);
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
                    authenticatedSignedWrites: characteristic.properties.authenticatedSignedWrites,
                    reliableWrite: characteristic.properties.reliableWrite,
                    writableAuxiliaries: characteristic.properties.writableAuxiliaries,
                });
                const duSerialNumber = await characteristic.readValue();
                const decodedValue = new TextDecoder().decode(duSerialNumber);
                this.logger.info("Raw DU Serial Number value:", Array.from(new Uint8Array(duSerialNumber.buffer)).map(b => b.toString(16).padStart(2, '0')).join(' '));
                this.logger.info("Decoded DU Serial Number:", decodedValue);
                if (!decodedValue || decodedValue.trim() === '') {
                    throw new Error("Received empty DU Serial Number");
                }
                this.duSerialNumber = decodedValue;
            }
        }
        catch (error) {
            this.logger.error("Error reading DU Serial Number:", error);
            this.duSerialNumber = null;
            throw error;
        }
    }
    getManufacturerSerialNumber() {
        return this.manufacturerSerialNumber;
    }
    async readManufacturerSerialNumber() {
        try {
            if (!this.isConnected) {
                throw new Error("Device is not connected");
            }
            // Add a small delay to ensure services are ready
            await new Promise(resolve => setTimeout(resolve, 500));
            if (core_1.Capacitor.isNativePlatform()) {
                if (!this.device || !this.isBleDevice(this.device)) {
                    throw new Error("Device not connected or not a BLE device");
                }
                this.logger.info("Reading Manufacturer Serial Number from native platform...");
                const manufacturerSerial = await bluetooth_le_1.BleClient.read(this.device.deviceId, this.DVB_SERVICE_UUID, this.DU_MANUFACTURER_SERIAL_UUID);
                const decodedValue = new TextDecoder().decode(manufacturerSerial);
                this.logger.info("Raw Manufacturer Serial Number value:", Array.from(new Uint8Array(manufacturerSerial.buffer)).map(b => b.toString(16).padStart(2, '0')).join(' '));
                this.logger.info("Decoded Manufacturer Serial Number:", decodedValue);
                this.manufacturerSerialNumber = decodedValue;
            }
            else {
                if (!this.serviceDVB) {
                    throw new Error("DVB service not available");
                }
                this.logger.info("Reading Manufacturer Serial Number from web platform...");
                const characteristic = await this.serviceDVB.getCharacteristic(this.DU_MANUFACTURER_SERIAL_UUID);
                if (!characteristic) {
                    throw new Error("Manufacturer Serial Number characteristic not found");
                }
                // Log the characteristic properties for debugging
                this.logger.info("Manufacturer Serial Number characteristic properties:", {
                    read: characteristic.properties.read,
                    write: characteristic.properties.write,
                    writeWithoutResponse: characteristic.properties.writeWithoutResponse,
                    notify: characteristic.properties.notify,
                    indicate: characteristic.properties.indicate,
                    broadcast: characteristic.properties.broadcast,
                    authenticatedSignedWrites: characteristic.properties.authenticatedSignedWrites,
                    reliableWrite: characteristic.properties.reliableWrite,
                    writableAuxiliaries: characteristic.properties.writableAuxiliaries,
                });
                const manufacturerSerial = await characteristic.readValue();
                const decodedValue = new TextDecoder().decode(manufacturerSerial);
                this.logger.info("Raw Manufacturer Serial Number value:", Array.from(new Uint8Array(manufacturerSerial.buffer)).map(b => b.toString(16).padStart(2, '0')).join(' '));
                this.logger.info("Decoded Manufacturer Serial Number:", decodedValue);
                this.manufacturerSerialNumber = decodedValue;
            }
        }
        catch (error) {
            this.logger.error("Error reading Manufacturer Serial Number:", error);
            throw error;
        }
    }
    async calculateSHA3Signature(serialNumber, randomValue) {
        // Test key as specified in the documentation
        const dvb_mac_key = new Uint8Array([
            0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
            0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF
        ]);
        // Convert serial number to bytes (96-bit = 12 bytes)
        const serialBytes = new TextEncoder().encode(serialNumber);
        // Combine the data as specified in the documentation
        const data = new Uint8Array(34); // 16 + 12 + 4 + 2 bytes
        data.set(dvb_mac_key, 0); // dvb_mac_key[0-15]
        data.set(serialBytes.slice(0, 12), 16); // 96-bit Serial Number [0-11]
        data.set(randomValue, 28); // Random Value [28-31]
        // Calculate SHA-256 hash (using SHA-256 as SHA3 is not supported by Web Crypto API)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = new Uint8Array(hashBuffer);
        // Return first 4 bytes as signature
        return hashArray.slice(0, 4);
    }
    async verifyDevice() {
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
            this.logger.info("Generated random value:", Array.from(randomValue).map(b => b.toString(16).padStart(2, '0')).join(' '));
            // Write random value to DU
            if (core_1.Capacitor.isNativePlatform()) {
                if (!this.device || !this.isBleDevice(this.device)) {
                    throw new Error("Device not connected or not a BLE device");
                }
                await bluetooth_le_1.BleClient.write(this.device.deviceId, this.DVB_SERVICE_UUID, this.DU_SERVER_REGISTRATION_UUID, new DataView(randomValue.buffer));
            }
            else {
                if (!this.serviceDVB) {
                    throw new Error("DVB service not available");
                }
                const characteristic = await this.serviceDVB.getCharacteristic(this.DU_SERVER_REGISTRATION_UUID);
                if (!characteristic) {
                    throw new Error("Server Registration characteristic not found");
                }
                if (!characteristic.properties.write && !characteristic.properties.writeWithoutResponse) {
                    throw new Error("Characteristic does not support writing");
                }
                if (characteristic.properties.writeWithoutResponse) {
                    await characteristic.writeValueWithoutResponse(randomValue);
                }
                else {
                    await characteristic.writeValue(randomValue);
                }
            }
            // Wait a bit for the device to process
            await new Promise(resolve => setTimeout(resolve, 500));
            // Read the response (should be SHA3 signature)
            let response;
            if (core_1.Capacitor.isNativePlatform()) {
                if (!this.device || !this.isBleDevice(this.device)) {
                    throw new Error("Device not connected or not a BLE device");
                }
                response = await bluetooth_le_1.BleClient.read(this.device.deviceId, this.DVB_SERVICE_UUID, this.DU_SERVER_REGISTRATION_UUID);
            }
            else {
                if (!this.serviceDVB) {
                    throw new Error("DVB service not available");
                }
                const characteristic = await this.serviceDVB.getCharacteristic(this.DU_SERVER_REGISTRATION_UUID);
                response = await characteristic.readValue();
            }
            // Calculate expected signature
            const expectedSignature = await this.calculateSHA3Signature(serialNumber, randomValue);
            // Compare signatures
            const responseArray = new Uint8Array(response.buffer);
            this.logger.info("Received signature length:", responseArray.length);
            this.logger.info("Received signature:", Array.from(responseArray).map(b => b.toString(16).padStart(2, '0')).join(' '));
            this.logger.info("Expected signature:", Array.from(expectedSignature).map(b => b.toString(16).padStart(2, '0')).join(' '));
            if (responseArray.length !== 4) {
                this.logger.error(`Invalid signature length: ${responseArray.length} (expected 4)`);
                return false;
            }
            const isVerified = responseArray.every((byte, index) => byte === expectedSignature[index]);
            this.logger.info("Device registration:", isVerified ? "OK" : "Error");
            return isVerified;
        }
        catch (error) {
            this.logger.error("Error during device registration", error);
            throw error;
        }
    }
    async calibrateAccel() {
        try {
            if (!this.isConnected) {
                throw new Error("Device is not connected");
            }
            const command = new Uint8Array([0x10]);
            if (core_1.Capacitor.isNativePlatform()) {
                if (!this.device || !this.isBleDevice(this.device)) {
                    throw new Error("Device not connected or not a BLE device");
                }
                await bluetooth_le_1.BleClient.write(this.device.deviceId, this.DVB_SERVICE_UUID, this.DU_SENSOR_SETTING_UUID, new DataView(command.buffer));
            }
            else {
                if (!this.serviceDVB) {
                    throw new Error("DVB service not available");
                }
                const characteristic = await this.serviceDVB.getCharacteristic(this.DU_SENSOR_SETTING_UUID);
                if (!characteristic) {
                    throw new Error("Sensor Setting characteristic not found");
                }
                if (!characteristic.properties.write && !characteristic.properties.writeWithoutResponse) {
                    throw new Error("Characteristic does not support writing");
                }
                if (characteristic.properties.writeWithoutResponse) {
                    await characteristic.writeValueWithoutResponse(command);
                }
                else {
                    await characteristic.writeValue(command);
                }
            }
            this.logger.info("ACCEL calibration command sent successfully");
        }
        catch (error) {
            this.logger.error("Error sending ACCEL calibration command", error);
            throw error;
        }
    }
    async calibrateMagn() {
        try {
            if (!this.isConnected) {
                throw new Error("Device is not connected");
            }
            const command = new Uint8Array([0x11]);
            if (core_1.Capacitor.isNativePlatform()) {
                if (!this.device || !this.isBleDevice(this.device)) {
                    throw new Error("Device not connected or not a BLE device");
                }
                await bluetooth_le_1.BleClient.write(this.device.deviceId, this.DVB_SERVICE_UUID, this.DU_SENSOR_SETTING_UUID, new DataView(command.buffer));
            }
            else {
                if (!this.serviceDVB) {
                    throw new Error("DVB service not available");
                }
                const characteristic = await this.serviceDVB.getCharacteristic(this.DU_SENSOR_SETTING_UUID);
                if (!characteristic) {
                    throw new Error("Sensor Setting characteristic not found");
                }
                if (!characteristic.properties.write && !characteristic.properties.writeWithoutResponse) {
                    throw new Error("Characteristic does not support writing");
                }
                if (characteristic.properties.writeWithoutResponse) {
                    await characteristic.writeValueWithoutResponse(command);
                }
                else {
                    await characteristic.writeValue(command);
                }
            }
            this.logger.info("MAGN calibration command sent successfully");
        }
        catch (error) {
            this.logger.error("Error sending MAGN calibration command", error);
            throw error;
        }
    }
    async testHardware() {
        try {
            if (!this.isConnected) {
                throw new Error("Device is not connected");
            }
            const command = new Uint8Array([0x20]);
            if (core_1.Capacitor.isNativePlatform()) {
                if (!this.device || !this.isBleDevice(this.device)) {
                    throw new Error("Device not connected or not a BLE device");
                }
                await bluetooth_le_1.BleClient.write(this.device.deviceId, this.DVB_SERVICE_UUID, this.DU_SENSOR_SETTING_UUID, new DataView(command.buffer));
            }
            else {
                if (!this.serviceDVB) {
                    throw new Error("DVB service not available");
                }
                const characteristic = await this.serviceDVB.getCharacteristic(this.DU_SENSOR_SETTING_UUID);
                if (!characteristic) {
                    throw new Error("Sensor Setting characteristic not found");
                }
                if (!characteristic.properties.write && !characteristic.properties.writeWithoutResponse) {
                    throw new Error("Characteristic does not support writing");
                }
                if (characteristic.properties.writeWithoutResponse) {
                    await characteristic.writeValueWithoutResponse(command);
                }
                else {
                    await characteristic.writeValue(command);
                }
            }
            this.logger.info("Hardware test command sent successfully");
        }
        catch (error) {
            this.logger.error("Error sending hardware test command", error);
            throw error;
        }
    }
}
exports.default = DVBDeviceBLE;
