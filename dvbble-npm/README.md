# DVBble

A TypeScript library for communicating with DVBuddy devices via Bluetooth Low Energy (BLE).

## Installation

```bash
npm install dvbble
```

## Usage

```typescript
import { DVBDeviceBLE } from 'dvbble';

// Create a new device instance
const device = new DVBDeviceBLE();

// Connect to a device
await device.connect();

// Register the device
await device.register();

// Upload firmware
const firmwareFile = new File([/* firmware data */], 'firmware.bin');
await device.uploadFirmware(firmwareFile);

// Disconnect when done
await device.disconnect();
```

## Features

- Device connection and disconnection
- Device registration
- Firmware upload
- Message handling
- Error handling

## API

### DVBDeviceBLE

The main class for interacting with DVBuddy devices.

#### Methods

- `connect()`: Connect to a DVBuddy device
- `disconnect()`: Disconnect from the device
- `register()`: Register the device
- `uploadFirmware(file: File)`: Upload firmware to the device

## License

MIT 