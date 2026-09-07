import { Bonjour } from "bonjour-service";
import dgram from "dgram";
import os from "os";

const SERVICE_TYPE = "filedrop";
const SERVICE_PORT = parseInt(process.env.PORT || "5000", 10);

// UDP broadcast beacon port for reliable same-network discovery.
const BEACON_PORT = parseInt(process.env.BEACON_PORT || "49999", 10);

let bonjour: Bonjour | null = null;
let published = false;

// ---------------------------------------------------------------------------
// Local IP selection
// ---------------------------------------------------------------------------

const VIRTUAL_IFACE_MARKERS = [
  "wsl", "vethernet", "docker", "vmware", "virtualbox", "hyper-v",
  "hyperv", "loopback", "tailscale", "zerotier", "vpn", "npcap",
  "bluetooth", "tunnel", "vbox", "nat", "default switch", "vpn",
];

function isRealInterface(name: string): boolean {
  const l = name.toLowerCase();
  return !VIRTUAL_IFACE_MARKERS.some((v) => l.includes(v));
}

function isPrivateLan(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function getLocalIP(): string {
  const interfaces = os.networkInterfaces();
  const real: string[] = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family !== "IPv4" || iface.internal) continue;
      const candidate = { name, address: iface.address };
      const isVirtual = !isRealInterface(candidate.name);
      if (isVirtual) continue;
      real.push(candidate.address);
    }
  }

  // Prefer a private LAN address (192.168.x, 10.x, 172.16-31.x).
  const lan = real.find((ip) => isPrivateLan(ip));
  if (lan) return lan;

  if (real.length > 0) return real[0];

  // Fallback: any non-internal IPv4.
  for (const iface of Object.values(interfaces).flat()) {
    if (iface && iface.family === "IPv4" && !iface.internal) {
      return iface.address;
    }
  }
  return "127.0.0.1";
}

function getDeviceName(): string {
  return process.env.DEVICE_NAME || os.hostname();
}

// ---------------------------------------------------------------------------
// UDP broadcast beacon
// ---------------------------------------------------------------------------

let beaconSocket: dgram.Socket | null = null;
let beaconTimer: NodeJS.Timeout | null = null;
let beaconRunning = false;

// Devices discovered via the UDP beacon, keyed by "ip:port".
const beaconDevices = new Map<string, DiscoveredDevice>();

function broadcastAddresses(): string[] {
  const addresses: string[] = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family !== "IPv4" || iface.internal) continue;
      if (!isRealInterface(name)) continue;
      // Compute the directed broadcast address from the subnet mask.
      const mask = netmaskToInt(iface.netmask);
      const ip = ipToInt(iface.address);
      if (mask === null || ip === null) continue;
      const broadcast = intToIp((ip & mask) | (~mask >>> 0));
      addresses.push(broadcast);
    }
  }
  // Always include the global broadcast address.
  addresses.push("255.255.255.255");
  return Array.from(new Set(addresses));
}

function netmaskToInt(netmask: string | undefined): number | null {
  if (!netmask) return null;
  const parts = netmask.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
  return ipToInt(parts.join("."));
}

function ipToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function intToIp(int: number): string {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8) & 255,
    int & 255,
  ].join(".");
}

function sendBeacon(): void {
  if (!beaconSocket) return;
  const message = Buffer.from(
    JSON.stringify({
      name: getDeviceName(),
      ip: getLocalIP(),
      port: SERVICE_PORT,
      hostname: os.hostname(),
      app: "filedrop",
    })
  );
  for (const addr of broadcastAddresses()) {
    beaconSocket.send(message, 0, message.length, BEACON_PORT, addr);
  }
}

export function startDiscovery(): void {
  if (published) return;

  bonjour = new Bonjour();

  const localIP = getLocalIP();
  const deviceName = getDeviceName();

  bonjour.publish({
    name: `FileDrop-${deviceName}`,
    type: SERVICE_TYPE,
    port: SERVICE_PORT,
    txt: {
      version: "1.0",
      name: deviceName,
      ip: localIP,
    },
  });

  published = true;
  console.log(`> mDNS: Published FileDrop as "FileDrop-${deviceName}" on ${localIP}:${SERVICE_PORT}`);

  // Start the UDP beacon as a reliable fallback for same-network discovery.
  startBeacon();
}

function startBeacon(): void {
  if (beaconRunning) return;

  beaconSocket = dgram.createSocket({ type: "udp4", reuseAddr: true });
  beaconSocket.on("message", (msg, rinfo) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data && data.app === "filedrop" && rinfo.address) {
        const port = data.port || SERVICE_PORT;
        // Ignore self.
        if (rinfo.address === getLocalIP() && port === SERVICE_PORT) return;

        const key = `${rinfo.address}:${port}`;
        beaconDevices.set(key, {
          name: String(data.name || "Unknown"),
          ip: rinfo.address,
          port,
          hostname: String(data.hostname || rinfo.address),
        });
      }
    } catch {
      // Ignore malformed packets.
    }
  });

  beaconSocket.on("error", (err) => {
    console.error(`> Beacon socket error: ${err.message}`);
  });

  beaconSocket.bind(BEACON_PORT, () => {
    beaconSocket?.setBroadcast(true);
    sendBeacon();
    console.log(`> Beacon: listening on UDP ${BEACON_PORT} (${getLocalIP()})`);
  });

  beaconTimer = setInterval(() => {
    sendBeacon();
  }, 2000);

  beaconRunning = true;
}

function stopBeacon(): void {
  if (beaconTimer) clearInterval(beaconTimer);
  beaconTimer = null;
  if (beaconSocket) beaconSocket.close();
  beaconSocket = null;
  beaconRunning = false;
}

export function stopDiscovery(): void {
  stopBeacon();
  if (bonjour) {
    bonjour.unpublishAll();
    bonjour.destroy();
    bonjour = null;
    published = false;
    console.log("> mDNS: Stopped discovery");
  }
}

export interface DiscoveredDevice {
  name: string;
  ip: string;
  port: number;
  hostname: string;
}

// ---------------------------------------------------------------------------
// Browsing
// ---------------------------------------------------------------------------

export function browseDevices(): Promise<DiscoveredDevice[]> {
  // Combine mDNS results and the UDP beacon cache.
  return new Promise((resolve) => {
    const devices = new Map<string, DiscoveredDevice>();

    // Start with devices already picked up by the UDP beacon.
    for (const dev of beaconDevices.values()) {
      devices.set(`${dev.ip}:${dev.port}`, dev);
    }

    // Also do a live mDNS browse.
    if (!bonjour) {
      bonjour = new Bonjour();
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (browser) browser.stop();
      resolve(Array.from(devices.values()));
    };

    // eslint-disable-next-line prefer-const
    let browser = bonjour.find({ type: SERVICE_TYPE }, (service) => {
      const ip = service.txt?.ip || service.referer?.address || "";
      const name = (service.name || "Unknown").replace("FileDrop-", "");

      // Don't add self.
      if (ip && ip === getLocalIP() && service.port === SERVICE_PORT) {
        return;
      }

      if (!devices.has(`${ip}:${service.port}`)) {
        devices.set(`${ip}:${service.port}`, {
          name,
          ip: ip || service.referer?.address || "unknown",
          port: service.port,
          hostname: service.host || "unknown",
        });
      }
    });

    // Resolve after 2 seconds of browsing.
    setTimeout(finish, 2000);
  });
}
