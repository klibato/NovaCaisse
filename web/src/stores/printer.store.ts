import { create } from 'zustand';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface USBDevice {
    open(): Promise<void>;
    close(): Promise<void>;
    selectConfiguration(configurationValue: number): Promise<void>;
    claimInterface(interfaceNumber: number): Promise<void>;
    transferOut(endpointNumber: number, data: any): Promise<any>;
    configuration: {
      interfaces: Array<{
        interfaceNumber: number;
        alternate: {
          endpoints: Array<{ direction: string; endpointNumber: number }>;
        };
      }>;
      configurationValue: number;
    } | null;
    configurations: Array<{ configurationValue: number }>;
  }
  interface USB {
    requestDevice(options: { filters: Array<Record<string, unknown>> }): Promise<USBDevice>;
  }
  interface Navigator {
    usb: USB;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

interface PrinterState {
  device: USBDevice | null;
  isConnected: boolean;
  isSupported: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  print: (data: Uint8Array) => Promise<void>;
}

export const usePrinterStore = create<PrinterState>()((set, get) => ({
  device: null,
  isConnected: false,
  isSupported: typeof navigator !== 'undefined' && 'usb' in navigator,

  connect: async () => {
    try {
      const device = await navigator.usb.requestDevice({
        filters: [], // Accept any USB device (thermal printers don't have a standard class)
      });
      await device.open();

      // Select the first configuration if needed
      if (device.configuration === null && device.configurations.length > 0) {
        await device.selectConfiguration(device.configurations[0].configurationValue);
      }

      // Claim the first interface
      const iface = device.configuration?.interfaces[0];
      if (iface) {
        await device.claimInterface(iface.interfaceNumber);
      }

      set({ device, isConnected: true });
    } catch (err) {
      console.warn('[NovaCaisse] Erreur connexion imprimante:', err);
      set({ device: null, isConnected: false });
    }
  },

  disconnect: async () => {
    const { device } = get();
    if (device) {
      try {
        await device.close();
      } catch {
        // ignore
      }
    }
    set({ device: null, isConnected: false });
  },

  print: async (data: Uint8Array) => {
    const { device } = get();
    if (!device) throw new Error('Imprimante non connectée');

    // Find OUT endpoint
    const iface = device.configuration?.interfaces[0];
    const endpoint = iface?.alternate.endpoints.find(
      (ep: USBEndpoint) => ep.direction === 'out',
    );

    if (endpoint) {
      await device.transferOut(endpoint.endpointNumber, data);
    } else {
      // Fallback: try control transfer or endpoint 1
      await device.transferOut(1, data);
    }
  },
}));
