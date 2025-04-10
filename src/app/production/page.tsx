"use client"

import React, { useState, useEffect,useRef } from "react";
import DVBDeviceBLE from "@/lib/DVBble";

export default function Production() {
    const dvbDevice = useRef(new DVBDeviceBLE());
    const [showConnected, setShowConnected] = useState(false);
    const [showConnecting, setShowConnecting] = useState(false);
    const [manufacturerSerial, setManufacturerSerial] = useState("");
    const [duSerialNumber, setDUSerialNumber] = useState("");
    const [isVerified, setIsVerified] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState<{
        status: 'idle' | 'in_progress' | 'completed' | 'error';
        message: string;
    }>({
        status: 'idle',
        message: ''
    });
    const [calibrationStatus, setCalibrationStatus] = useState<{
        type: 'accel' | 'magn' | 'hardware' | null;
        status: 'idle' | 'in_progress' | 'completed' | 'error';
        message: string;
    }>({
        type: null,
        status: 'idle',
        message: ''
    });

    useEffect(() => {
        const handleDisconnect = () => {
            setShowConnected(false);
            setShowConnecting(false);
            setVerificationStatus({
                status: 'idle',
                message: ''
            });
            setCalibrationStatus({
                type: null,
                status: 'idle',
                message: ''
            });
        };

        dvbDevice.current.onDisconnect(handleDisconnect);

        if (dvbDevice.current.onConnecting) {
            dvbDevice.current.onConnecting(() => {
                setShowConnecting(true);
                setShowConnected(false);
            });
        }
        
        if (dvbDevice.current.onConnect) {
            dvbDevice.current.onConnect(() => {
                setShowConnecting(false);
                setShowConnected(true);
            });
        }
    }, []);

    const connectDevice = async () => {
        if (!showConnected && !showConnecting) {
            setShowConnecting(true);
            try {
                console.log('Starting device connection...');
                await dvbDevice.current.connect();
                console.log('Device connected successfully');
                
                console.log('Reading manufacturer serial number...');
                await dvbDevice.current.readManufacturerSerialNumber();
                const serial = dvbDevice.current.getManufacturerSerialNumber();
                console.log('Manufacturer Serial Number:', serial);
                setManufacturerSerial(serial || "");

                console.log('Reading DU serial number...');
                await dvbDevice.current.readDUSerialNumber();
                const duSerial = dvbDevice.current.getDUSerialNumber();
                console.log('DU Serial Number:', duSerial);
                setDUSerialNumber(duSerial || "");
                
                console.log('Starting device verification...');
                setVerificationStatus({
                    status: 'in_progress',
                    message: 'Verifying device...'
                });
                const verified = await dvbDevice.current.verifyDevice();
                setIsVerified(verified);
                setVerificationStatus({
                    status: 'completed',
                    message: verified ? 'Device verified successfully' : 'Device verification failed'
                });
                setTimeout(() => {
                    setVerificationStatus({
                        status: 'idle',
                        message: ''
                    });
                }, 3000);
            } catch (error) {
                console.error('Connection error:', error);
                setShowConnecting(false);
                setVerificationStatus({
                    status: 'error',
                    message: 'Connection error'
                });
                setTimeout(() => {
                    setVerificationStatus({
                        status: 'idle',
                        message: ''
                    });
                }, 3000);
            }
        } else {
            try {
                console.log('Disconnecting device...');
                await dvbDevice.current.disconnect();
                console.log('Device disconnected successfully');
            } catch (error) {
                console.error('Disconnection error:', error);
            }
        }
    };

    const handleCalibrateAccel = async () => {
        try {
            setCalibrationStatus({
                type: 'accel',
                status: 'in_progress',
                message: 'ACCEL calibration in progress...'
            });
            await dvbDevice.current.calibrateAccel();
            setCalibrationStatus({
                type: 'accel',
                status: 'completed',
                message: 'ACCEL calibration completed successfully'
            });
            setTimeout(() => {
                setCalibrationStatus({
                    type: null,
                    status: 'idle',
                    message: ''
                });
            }, 3000);
        } catch (error) {
            console.error('ACCEL calibration error:', error);
            setCalibrationStatus({
                type: 'accel',
                status: 'error',
                message: 'ACCEL calibration failed'
            });
            setTimeout(() => {
                setCalibrationStatus({
                    type: null,
                    status: 'idle',
                    message: ''
                });
            }, 3000);
        }
    };

    const handleCalibrateMagn = async () => {
        try {
            setCalibrationStatus({
                type: 'magn',
                status: 'in_progress',
                message: 'MAGN calibration in progress...'
            });
            await dvbDevice.current.calibrateMagn();
            setCalibrationStatus({
                type: 'magn',
                status: 'completed',
                message: 'MAGN calibration completed successfully'
            });
            setTimeout(() => {
                setCalibrationStatus({
                    type: null,
                    status: 'idle',
                    message: ''
                });
            }, 3000);
        } catch (error) {
            console.error('MAGN calibration error:', error);
            setCalibrationStatus({
                type: 'magn',
                status: 'error',
                message: 'MAGN calibration failed'
            });
            setTimeout(() => {
                setCalibrationStatus({
                    type: null,
                    status: 'idle',
                    message: ''
                });
            }, 3000);
        }
    };

    const handleTestHardware = async () => {
        try {
            setCalibrationStatus({
                type: 'hardware',
                status: 'in_progress',
                message: 'Hardware test in progress...'
            });
            await dvbDevice.current.testHardware();
            setCalibrationStatus({
                type: 'hardware',
                status: 'completed',
                message: 'Hardware test completed successfully'
            });
            setTimeout(() => {
                setCalibrationStatus({
                    type: null,
                    status: 'idle',
                    message: ''
                });
            }, 3000);
        } catch (error) {
            console.error('Hardware test error:', error);
            setCalibrationStatus({
                type: 'hardware',
                status: 'error',
                message: 'Hardware test failed'
            });
            setTimeout(() => {
                setCalibrationStatus({
                    type: null,
                    status: 'idle',
                    message: ''
                });
            }, 3000);
        }
    };

    return (
        <section>
            <h1 className="text-2xl font-bold mb-4">Production</h1>
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
                <div className="space-y-4">
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h2 className="text-xl font-semibold mb-2">Device Information</h2>
                        <p>DU Serial Number: {duSerialNumber}</p>
                        <p>Manufacturer Serial Number: {manufacturerSerial}</p>
                        <p>Verification Status: {isVerified ? "Registered" : "Not Registered"}</p>
                    </div>

                    

                    <div className="bg-white p-4 rounded-lg shadow">
                        <h2 className="text-xl font-semibold mb-2">Board Test</h2>
                        <div className="space-y-4">
                            <button
                                onClick={handleTestHardware}
                                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                            >
                                Test Hardware
                            </button>
                            <div className="space-x-4">
                                <button
                                    onClick={handleCalibrateAccel}
                                    className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                                >
                                    Calibrate ACCEL
                                </button>
                                <button
                                    onClick={handleCalibrateMagn}
                                    className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                                >
                                    Calibrate MAGN
                                </button>
                            </div>
                        </div>
                    </div>
                    {verificationStatus.status !== 'idle' && (
                        <div className={`p-4 rounded-lg shadow ${
                            verificationStatus.status === 'error' 
                                ? 'bg-red-100 text-red-700' 
                                : verificationStatus.status === 'completed'
                                    ? verificationStatus.message.includes('failed') 
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-green-100 text-green-700'
                                    : 'bg-blue-100 text-blue-700'
                        }`}>
                            {verificationStatus.message.replace('verified', 'registered')}
                        </div>
                    )}

                    {calibrationStatus.status !== 'idle' && (
                        <div className={`p-4 rounded-lg shadow ${
                            calibrationStatus.status === 'error' 
                                ? 'bg-red-100 text-red-700' 
                                : calibrationStatus.status === 'completed'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-blue-100 text-blue-700'
                        }`}>
                            {calibrationStatus.message}
                        </div>
                    )}
                </div>
            )}
        </section>
    )
}
